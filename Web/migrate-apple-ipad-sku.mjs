// Migrate existing iPad ProductVariant SKUs to the family-qualified scheme.
// Run from Web/:
//   node migrate-apple-ipad-sku.mjs           # DRY RUN
//   node migrate-apple-ipad-sku.mjs --apply    # write to DB
//
// Pairs with the apple.py change (2026-07-23) that now derives the iPad
// SKU as `{family_slug}-{url_tail}` instead of the bare tail. Without this
// migration the next Apple scrape would produce SKUs that don't match the
// existing (bare) variant SKUs, and matcher_apple.py would CREATE duplicate
// variants instead of updating the current ones.
//
// New scheme:  {product.family}-{tail}
//   base iPad  128gb-azul-wifi        → ipad-128gb-azul-wifi
//   iPad mini  128gb-azul-wifi        → ipad-mini-128gb-azul-wifi
//   iPad Pro   11-256gb-...-wifi      → ipad-pro-11-256gb-...-wifi
//   iPad Air   ...                    → ipad-air-...
// Idempotent: a sku already starting with `{family}-` is stripped first,
// so re-running produces no changes (base-iPad Azul rows already prefixed
// by the earlier manual fix stay put).
//
// Only cat='ipad' variants are touched — iPhone/Mac/AirPods/Watch SKUs are
// left exactly as-is (apple.py still emits bare/part-number SKUs for them).
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const p = new PrismaClient();

const vars = await p.productVariant.findMany({
  where: { product: { cat: 'ipad' } },
  include: { product: true },
  orderBy: { id: 'asc' },
});

// Build the set of all existing SKUs so we can detect collisions the
// rename would cause (target sku already held by a DIFFERENT variant).
const skuOwner = new Map();
for (const v of vars) if (v.sku) skuOwner.set(v.sku, v.id);

const plan = [];
const conflicts = [];
for (const v of vars) {
  const fam = v.product.family;              // e.g. 'ipad', 'ipad-mini'
  if (!fam) continue;
  const cur = v.sku || '';
  const prefix = `${fam}-`;
  const tail = cur.startsWith(prefix) ? cur.slice(prefix.length) : cur;
  const next = `${fam}-${tail}`;
  if (next === cur) continue;                // already correct
  // Collision: someone else already owns the target sku?
  const owner = skuOwner.get(next);
  if (owner != null && owner !== v.id) {
    conflicts.push({ v, next, owner });
  } else {
    plan.push({ v, cur, next });
  }
}

console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — iPad variant SKU family-qualification\n`);
console.log(`  ${vars.length} iPad variants scanned, ${plan.length} to rename, ${conflicts.length} conflicts.\n`);

if (conflicts.length) {
  console.log('  ⚠️ CONFLICTS (target sku already used — NOT changed, inspect manually):');
  for (const { v, next, owner } of conflicts) {
    console.log(`     v${v.id} "${v.product.family}/${v.nombre}" sku='${v.sku}' → '${next}' (held by v${owner})`);
  }
  console.log('');
}

if (plan.length) {
  console.log(`  ${'vId'.padEnd(6)} ${'fam/variant'.padEnd(40)} ${'old sku'.padEnd(26)} → new sku`);
  console.log(`  ${'-'.repeat(6)} ${'-'.repeat(40)} ${'-'.repeat(26)}   ${'-'.repeat(30)}`);
  for (const { v, cur, next } of plan) {
    const fv = `${v.product.family}/${v.nombre}`.slice(0, 40).padEnd(40);
    console.log(`  ${String(v.id).padEnd(6)} ${fv} ${cur.slice(0, 26).padEnd(26)} → ${next}`);
  }
}

if (!APPLY) {
  console.log(`\n${plan.length} rename(s) pending. Re-run with --apply to write.`);
  await p.$disconnect();
  process.exit(0);
}

let done = 0;
for (const { v, next } of plan) {
  await p.productVariant.update({ where: { id: v.id }, data: { sku: next } });
  done++;
}
console.log(`\n✅ Renamed ${done} iPad variant SKU(s).`);
if (conflicts.length) {
  console.log(`⚠️ ${conflicts.length} conflict(s) skipped — resolve before re-scraping.`);
}
console.log('\nNext: re-run the Apple scrape + matcher so prices land on the');
console.log('correct variants:');
console.log('   cd ..\\Scraper');
console.log('   python -m stores.apple --family ipad ipad-mini ipad-pro ipad-air');
console.log('   python -m stores.matcher_apple');

await p.$disconnect();
