// check-mac-prices.mjs
// Diagnostic: dump every Mac variant (iMac / Mac Studio / Mac mini /
// MacBook Pro / MacBook Air / MacBook Neo) with its Apple Store price vs
// its stored msrp, and flag anomalies:
//   - price != msrp (Apple price should always equal our msrp — it IS
//     the source of truth)
//   - duplicate price shared across variants that should differ (chip/
//     cores/RAM/storage all distinct but identical price = matcher
//     probably wrote the wrong variant's price)
//   - missing Apple price row entirely
//
// Usage: node check-mac-prices.mjs [--family macbook-pro] [--all]
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const famFilter = (() => {
  const i = args.indexOf('--family');
  return i >= 0 ? args[i + 1] : null;
})();

async function main() {
  const products = await prisma.product.findMany({
    where: { cat: 'mac', ...(famFilter ? { family: famFilter } : {}) },
    include: {
      variants: {
        include: { prices: { where: { storeId: 'apple' } } },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { family: 'asc' },
  });

  if (!products.length) {
    console.log('No Mac products found' + (famFilter ? ` for family=${famFilter}` : '') + '.');
    return;
  }

  let anomalies = 0;
  let missing = 0;

  for (const p of products) {
    console.log(`\n━━━ ${p.nombre}  (family=${p.family}, ${p.variants.length} variants) ━━━`);
    // Group by price to spot suspicious duplicates
    const byPrice = new Map();

    for (const v of p.variants) {
      const price = v.prices[0]?.price;
      const url = v.prices[0]?.url || '';
      const msrp = v.msrp;
      const mismatch = price != null && msrp != null && Math.abs(price - msrp) > 0.5;
      const tag = price == null ? '❌ NO PRICE' : mismatch ? '⚠️  MISMATCH' : '✅';

      if (price == null) missing++;
      if (mismatch) anomalies++;

      if (price != null) {
        const key = price.toFixed(2);
        if (!byPrice.has(key)) byPrice.set(key, []);
        byPrice.get(key).push(v);
      }

      const desc = [v.display, v.cpu, v.cpuCores && v.gpuCores ? `${v.cpuCores}c/${v.gpuCores}g` : '',
                    v.ram, v.memory, v.color, v.screen, v.soporte]
        .filter(Boolean).join(' · ');
      console.log(`  ${tag}  [${v.id}] ${desc}`);
      console.log(`       sku=${v.sku}`);
      console.log(`       msrp=${msrp}  applePrice=${price}  url=${url.slice(-70)}`);
    }

    // Flag groups of 3+ variants sharing an identical price where their
    // specs actually differ (chip/cores/RAM/storage) — strong signal of
    // a stuck/duplicated price.
    for (const [price, vs] of byPrice) {
      if (vs.length >= 3) {
        const distinctSpecs = new Set(vs.map(v => `${v.cpu}|${v.cpuCores}|${v.gpuCores}|${v.ram}|${v.memory}|${v.color}|${v.screen}`));
        if (distinctSpecs.size > 1) {
          console.log(`  🔎 SUSPICIOUS: ${vs.length} variants with different specs all show €${price}:`);
          for (const v of vs) console.log(`       [${v.id}] sku=${v.sku}`);
          anomalies++;
        }
      }
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  products checked: ${products.length}`);
  console.log(`  missing apple price: ${missing}`);
  console.log(`  anomalies flagged:   ${anomalies}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
