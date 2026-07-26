// check-price-anomalies.mjs
// Flags single-store prices that look like scraping/matching errors:
// way below what every other store (and Apple's own msrp) charges for
// the exact same variant. A real seasonal discount usually still sits
// within ~30% of the pack; a wrong-product-match or stale/expired price
// tends to be a much bigger, single-store outlier.
//
// Heuristic per variant:
//   - collect all current Price rows (any store) + msrp as reference points
//   - median = median of all those prices
//   - a store's price is flagged if:
//       price < 0.65 * median   (i.e. >35% below the pack)
//     AND price < 0.75 * secondLowestOtherPrice (a real outlier, not just
//         "cheapest legit store")
//
// Usage: node check-price-anomalies.mjs [--threshold 0.65]
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const thIdx = args.indexOf('--threshold');
const THRESHOLD = thIdx >= 0 ? parseFloat(args[thIdx + 1]) : 0.65;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const variants = await prisma.productVariant.findMany({
    include: {
      prices: { include: { store: true } },
      product: true,
    },
  });

  const flagged = [];

  for (const v of variants) {
    const points = v.prices
      .filter(p => p.price != null && p.price > 0)
      .map(p => ({ storeId: p.storeId, storeName: p.store?.nombre || p.storeId, price: p.price, updatedAt: p.updatedAt }));
    if (v.msrp) points.push({ storeId: '__msrp__', storeName: 'MSRP', price: v.msrp, updatedAt: null });

    if (points.length < 3) continue; // need at least a few reference points

    const allPrices = points.map(p => p.price);
    const med = median(allPrices);

    for (const p of points) {
      if (p.storeId === '__msrp__') continue;
      // "others" excludes this exact point (by array position, not just
      // value, so two stores genuinely tied at the same price don't
      // wrongly exclude each other).
      const others = points.filter(x => x !== p).map(x => x.price);
      const lowestOther = others.length ? Math.min(...others) : undefined;

      const belowMedian = p.price < THRESHOLD * med;
      const belowLowestOther = lowestOther !== undefined && p.price < 0.75 * lowestOther;

      if (belowMedian && belowLowestOther) {
        const daysOld = p.updatedAt ? Math.round((Date.now() - new Date(p.updatedAt)) / 86400000) : null;
        flagged.push({
          product: v.product.nombre,
          variant: v.nombre,
          variantId: v.id,
          store: p.storeName,
          storeId: p.storeId,
          price: p.price,
          median: med,
          ratio: (p.price / med).toFixed(2),
          daysOld,
        });
      }
    }
  }

  if (!flagged.length) {
    console.log('No anomalies found.');
    return;
  }

  console.log(`\n⚠️  ${flagged.length} anomalies (price < ${THRESHOLD}× median AND < 0.75× next-lowest store):\n`);
  for (const f of flagged) {
    console.log(`[${f.storeId}] ${f.product} — ${f.variant} (variant ${f.variantId})`);
    console.log(`    price=${f.price}€  median=${f.median.toFixed(0)}€  ratio=${f.ratio}  updated ${f.daysOld}d ago`);
  }

  // storeId (DB) -> scraper module name (stores/*.py) — these diverge for
  // pccomp (module is pccomponentes.py) and istore (module is ktuin.py).
  const MODULE_MAP = {
    apple: 'apple', amazon: 'amazon', mediamarkt: 'mediamarkt',
    pccomp: 'pccomponentes', fnac: 'fnac', elcorte: 'elcorte',
    worten: 'worten', istore: 'ktuin', rossellimac: 'rossellimac',
  };

  // Group by (store, product) so variants of the same family flagged
  // together share one command, but the --variant-id list still scopes
  // the write to just the flagged SKUs — not the whole product family.
  console.log(`\n━━━ Re-scrape commands (run from Scraper/, targets ONLY the flagged SKU) ━━━`);
  const byStoreProduct = new Map();
  for (const f of flagged) {
    const key = `${f.storeId}|${f.product}`;
    if (!byStoreProduct.has(key)) byStoreProduct.set(key, { product: f.product, storeId: f.storeId, ids: [] });
    byStoreProduct.get(key).ids.push(f.variantId);
  }
  for (const { product, storeId, ids } of byStoreProduct.values()) {
    const mod = MODULE_MAP[storeId] || storeId;
    console.log(`python -m stores.${mod} --product "${product}" --variant-id ${ids.join(',')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
