// Clean up duplicate iPad variants created by the 2026-07-23 re-scrape.
// Run from Web/:
//   node dedup-apple-ipad-variants.mjs           # DRY RUN
//   node dedup-apple-ipad-variants.mjs --apply     # delete
//
// What happened: after migrating iPad variant SKUs to the family-qualified
// scheme and re-scraping, matcher_apple.py (which reprocesses EVERY
// ScrapedProduct row for storeId='apple', not just today's) matched TWO
// rows per config:
//   - the new prefixed row  (ipad-mini-128gb-azul-wifi) → updated the
//     migrated canonical variant  ✓
//   - a stale bare row       (128gb-azul-wifi)          → had no matching
//     variant anymore, so matcher INSERTED a bare-sku duplicate  ✗
//
// This script removes the bare-sku duplicates, but ONLY when a correct
// prefixed twin (same product, sku == '{family}-{bareSku}') exists — so we
// never delete a variant that isn't safely superseded. It then deletes the
// stale bare ScrapedProduct rows so the next matcher run can't recreate them.
//
// Deleting a variant cascades its Price + PriceHistory (schema onDelete:
// Cascade) and nulls ScrapedProduct.variantId — all fine, the canonical
// twin already carries the fresh price.
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const p = new PrismaClient();

const vars = await p.productVariant.findMany({
  where: { product: { cat: 'ipad' } },
  include: { product: true, prices: { where: { storeId: 'apple' } } },
  orderBy: { id: 'asc' },
});

// Index variants by (productId, sku) for twin lookup.
const bySku = new Map();
for (const v of vars) if (v.sku) bySku.set(`${v.productId}::${v.sku}`, v);

const dupes = [];       // variants to delete
const orphans = [];     // bare variants with NO prefixed twin (leave, report)

for (const v of vars) {
  const fam = v.product.family;
  const prefix = `${fam}-`;
  if (!v.sku || v.sku.startsWith(prefix)) continue;   // canonical, keep
  // bare sku → expected twin
  const twinSku = `${fam}-${v.sku}`;
  const twin = bySku.get(`${v.productId}::${twinSku}`);
  if (twin && twin.id !== v.id) {
    dupes.push({ v, twin });
  } else {
    orphans.push(v);
  }
}

console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — iPad duplicate-variant cleanup\n`);
console.log(`  ${vars.length} iPad variants, ${dupes.length} bare duplicates to delete, ${orphans.length} orphan(s) without a prefixed twin.\n`);

if (orphans.length) {
  console.log('  ⚠️ ORPHANS (bare sku, NO prefixed twin — NOT deleted, inspect):');
  for (const v of orphans) {
    console.log(`     v${v.id} ${v.product.family}/${v.nombre} sku='${v.sku}' apple=${v.prices[0]?.price ?? '-'}€`);
  }
  console.log('');
}

if (dupes.length) {
  console.log(`  ${'delete vId'.padEnd(11)} ${'fam/variant'.padEnd(40)} ${'bare sku'.padEnd(22)} keeps → twin vId`);
  console.log(`  ${'-'.repeat(11)} ${'-'.repeat(40)} ${'-'.repeat(22)} ${'-'.repeat(14)}`);
  for (const { v, twin } of dupes) {
    const fv = `${v.product.family}/${v.nombre}`.slice(0, 40).padEnd(40);
    console.log(`  ${String(v.id).padEnd(11)} ${fv} ${(v.sku||'').slice(0,22).padEnd(22)} → v${twin.id} (${twin.prices[0]?.price ?? '-'}€)`);
  }
}

if (!APPLY) {
  console.log(`\n${dupes.length} variant(s) would be deleted. Re-run with --apply.`);
  await p.$disconnect();
  process.exit(0);
}

// Delete duplicate variants (Price + PriceHistory cascade).
const dupeIds = dupes.map(d => d.v.id);
const bareSkus = [...new Set(dupes.map(d => d.v.sku))];

let delVars = 0;
for (const id of dupeIds) {
  await p.productVariant.delete({ where: { id } });
  delVars++;
}

// Delete the stale bare ScrapedProduct rows (storeId='apple') that would
// otherwise recreate these variants on the next matcher run.
const delSp = await p.scrapedProduct.deleteMany({
  where: { storeId: 'apple', sku: { in: bareSkus } },
});

console.log(`\n✅ Deleted ${delVars} duplicate variant(s) and ${delSp.count} stale ScrapedProduct row(s).`);
console.log('   Verify: node check-ipadmini-collision.mjs  (each config should now');
console.log('   appear ONCE, with a family-prefixed sku).');

await p.$disconnect();
