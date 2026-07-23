// iPad mini vs base iPad SKU-collision diagnostic.
// Run from Web/:  node check-ipadmini-collision.mjs
//
// Symptom (2026-07-23): iPad mini Azul shows Apple Store price 499€
// (128GB) / 629€ (256) / 879€ (512) — these are BASE iPad prices, not
// iPad mini. Other iPad mini colors correctly show 679/809/1059€.
// Hypothesis: iPad mini Azul variants' Apple Price rows point at the
// base iPad's SKU/URL (recurrence of the known iPad SKU collision).
//
// This prints, for the iPad mini and base iPad Products, every variant
// with its Apple Price row (price, sku, url, updatedAt) so we can see
// exactly which rows collide and which are the correct records.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

for (const fam of ['ipad-mini', 'ipad']) {
  const prods = await p.product.findMany({
    where: { family: fam },
    include: {
      variants: {
        include: {
          prices: { where: { storeId: 'apple' } },
        },
        orderBy: { id: 'asc' },
      },
    },
  });

  for (const prod of prods) {
    console.log(`\n═══ ${prod.nombre}  (family=${prod.family}, productId=${prod.id}, slug=${prod.slug}) ═══`);
    console.log(
      `  ${'vId'.padEnd(6)} ${'variant'.padEnd(34)} ${'aplPrice'.padEnd(9)} ${'msrp'.padEnd(8)} ${'sku'.padEnd(20)} url`
    );
    for (const v of prod.variants) {
      const apl = v.prices[0];
      const vId   = String(v.id).padEnd(6);
      const vname = (v.nombre || '').slice(0, 34).padEnd(34);
      const price = apl ? `${apl.price}€`.padEnd(9) : '(none)'.padEnd(9);
      const msrp  = v.msrp ? `${v.msrp}€`.padEnd(8) : '-'.padEnd(8);
      const sku   = (v.sku || '-').slice(0, 20).padEnd(20);
      const url   = apl?.url || '-';
      console.log(`  ${vId} ${vname} ${price} ${msrp} ${sku} ${url}`);
    }
  }
}

// Direct collision test: any Apple Price URL shared by an iPad mini
// variant AND a base iPad variant?
const miniVars = await p.productVariant.findMany({
  where: { product: { family: 'ipad-mini' } },
  include: { prices: { where: { storeId: 'apple' } }, product: true },
});
const baseVars = await p.productVariant.findMany({
  where: { product: { family: 'ipad' } },
  include: { prices: { where: { storeId: 'apple' } }, product: true },
});

const baseByUrl = new Map();
const baseBySku = new Map();
for (const v of baseVars) {
  if (v.sku) baseBySku.set(v.sku, v);
  const u = v.prices[0]?.url;
  if (u) baseByUrl.set(u, v);
}

console.log('\n\n═══ COLLISION CHECK (iPad mini variant sharing base-iPad sku/url) ═══');
let hits = 0;
for (const v of miniVars) {
  const u = v.prices[0]?.url;
  const skuHit = v.sku && baseBySku.has(v.sku) ? baseBySku.get(v.sku) : null;
  const urlHit = u && baseByUrl.has(u) ? baseByUrl.get(u) : null;
  if (skuHit || urlHit) {
    hits++;
    const other = skuHit || urlHit;
    console.log(
      `  ⚠️ mini v${v.id} "${v.nombre}" (${v.prices[0]?.price}€) shares ` +
      `${skuHit ? 'SKU' : 'URL'} with base iPad v${other.id} "${other.nombre}" (${other.prices[0]?.price}€)`
    );
  }
}
if (!hits) console.log('  ✅ No shared sku/url between iPad mini and base iPad Apple rows.');

await p.$disconnect();
