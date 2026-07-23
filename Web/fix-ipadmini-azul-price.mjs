// One-shot fix: iPad mini Azul Wi-Fi Apple Store price collision.
// Run from Web/:
//   node fix-ipadmini-azul-price.mjs           # DRY RUN (shows changes)
//   node fix-ipadmini-azul-price.mjs --apply    # write to DB
//
// Bug (2026-07-23): iPad mini Azul Wi-Fi variants (128/256/512) show the
// BASE iPad's Apple Store price (499/629/879 €) instead of their own
// (679/809/1059 €). Root cause: ScrapedProduct has @@unique([sku,storeId])
// and apple.py derives sku from the URL slug TAIL, which is identical for
// base iPad (.../ipad/128gb-azul-wifi) and mini (.../ipad-mini/128gb-azul-wifi).
// Azul is the only colour shared by both families, so exactly the 3 Wi-Fi
// Azul mini configs collide. The Wi-Fi+Cellular Azul minis are unaffected
// (their tail '...-wifiycellular' differs from base iPad's '...-wifi-cellular').
//
// Correct price for the Apple Store == the variant's msrp (Apple sells at
// list price). This script sets Price.price = variant.msrp for any
// ipad-mini variant whose Apple price currently disagrees with its msrp,
// clears a stale oldPrice, and logs a PriceHistory row.
//
// This is a DATA correction only. The permanent fix is in apple.py
// (make the ScrapedProduct sku family-qualified) — see TODO.md.
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const p = new PrismaClient();

const vars = await p.productVariant.findMany({
  where: { product: { family: 'ipad-mini' } },
  include: { prices: { where: { storeId: 'apple' } }, product: true },
  orderBy: { id: 'asc' },
});

const toFix = [];
for (const v of vars) {
  const apl = v.prices[0];
  if (!apl) continue;
  if (v.msrp == null) continue;
  // Only correct where the Apple price disagrees with the official msrp.
  if (Math.abs(apl.price - v.msrp) > 0.01) {
    toFix.push({ v, apl });
  }
}

console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — iPad mini Apple price != msrp\n`);
if (toFix.length === 0) {
  console.log('  Nothing to fix — every iPad mini Apple price already matches msrp.');
  await p.$disconnect();
  process.exit(0);
}

console.log(`  ${'vId'.padEnd(6)} ${'variant'.padEnd(34)} ${'current'.padEnd(9)} ${'→ msrp'.padEnd(9)}`);
console.log(`  ${'-'.repeat(6)} ${'-'.repeat(34)} ${'-'.repeat(9)} ${'-'.repeat(9)}`);
for (const { v, apl } of toFix) {
  console.log(
    `  ${String(v.id).padEnd(6)} ${(v.nombre || '').slice(0, 34).padEnd(34)} ` +
    `${`${apl.price}€`.padEnd(9)} ${`${v.msrp}€`.padEnd(9)}`
  );
}

if (!APPLY) {
  console.log(`\n${toFix.length} row(s) would change. Re-run with --apply to write.`);
  await p.$disconnect();
  process.exit(0);
}

let changed = 0;
for (const { v, apl } of toFix) {
  await p.price.update({
    where: { id: apl.id },
    data: { price: v.msrp, oldPrice: null, scrapedAt: new Date(), updatedAt: new Date() },
  });
  await p.priceHistory.create({
    data: { variantId: v.id, storeId: 'apple', price: v.msrp, date: new Date() },
  });
  changed++;
}
console.log(`\n✅ Updated ${changed} Apple price row(s) to msrp + logged PriceHistory.`);
console.log('   Note: /api/products is ISR-cached 1h — the site may take up to');
console.log('   an hour to reflect this, or redeploy / wait for revalidation.');

await p.$disconnect();
