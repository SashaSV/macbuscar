// check-variant-price.mjs
// Quick inspector: dump every Price row (store, url, price, discontinued,
// lastSeenAt, updatedAt) for one or more variantIds. Used to see WHICH
// saved URL a store's Price row points at — e.g. to confirm whether a
// flagged anomaly is a stale wrong-SKU URL (needs re-discovery) or a
// fresh, correct listing at a genuinely discounted price (no action
// needed).
//
// Usage: node check-variant-price.mjs 294 137 216
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ids = process.argv.slice(2).map(Number).filter(Boolean);
if (!ids.length) {
  console.log('Usage: node check-variant-price.mjs <variantId> [variantId ...]');
  process.exit(1);
}

async function main() {
  for (const id of ids) {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: { product: true, prices: { include: { store: true } } },
    });
    if (!variant) { console.log(`\n=== variant ${id}: NOT FOUND ===`); continue; }
    console.log(`\n=== variant ${id}: ${variant.product.nombre} — ${variant.nombre} (msrp=${variant.msrp}€) ===`);
    for (const p of variant.prices) {
      console.log(`  [${p.storeId}] ${p.price}€  discontinued=${p.discontinued}  lastSeenAt=${p.lastSeenAt?.toISOString().slice(0,10)}  updatedAt=${p.updatedAt?.toISOString().slice(0,10)}`);
      console.log(`      ${p.url}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
