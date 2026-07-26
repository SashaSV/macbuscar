// get-sample-urls.mjs
// Research step for the "search-every-time vs direct-URL price-check"
// question: pull 2 real, currently-saved Price.url values per store so
// we can test-fetch each store's actual PRODUCT DETAIL page (not the
// search results page) and see whether it exposes price via JSON-LD or
// a stable selector — the prerequisite for building a direct-URL
// price-check path instead of always re-searching.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, nombre: true } });
  for (const s of stores) {
    if (s.id === 'apple') continue; // apple already has its own two-stage pipeline
    const prices = await prisma.price.findMany({
      where: { storeId: s.id, url: { not: null } },
      take: 2,
      orderBy: { updatedAt: 'desc' },
      select: { url: true, price: true, variantId: true },
    });
    console.log(`\n=== ${s.id} (${s.nombre}) ===`);
    if (!prices.length) { console.log('  (no Price rows with url)'); continue; }
    for (const p of prices) {
      console.log(`  variant ${p.variantId}  ${p.price}€  ${p.url}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
