// check-store-freshness.mjs
// Diagnostic: for every store, show the REAL updatedAt from the Price
// table directly (bypassing the frontend / ISR cache) so we can tell
// whether "actualizado 22 jul" on the site is a real DB-staleness
// problem or a frontend rendering / cache artifact.
//
// Usage: node check-store-freshness.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({ orderBy: { id: 'asc' } });
  const now = new Date();

  for (const s of stores) {
    const prices = await prisma.price.findMany({
      where: { storeId: s.id },
      select: { updatedAt: true, scrapedAt: true },
    });
    if (!prices.length) {
      console.log(`${s.id.padEnd(14)}  0 rows`);
      continue;
    }
    const updated = prices.map(p => p.updatedAt.getTime()).sort((a, b) => a - b);
    const scraped = prices.map(p => p.scrapedAt.getTime()).sort((a, b) => a - b);
    const oldestU = new Date(updated[0]);
    const newestU = new Date(updated[updated.length - 1]);
    const oldestS = new Date(scraped[0]);
    const newestS = new Date(scraped[scraped.length - 1]);
    const ageHoursNewestU = ((now - newestU) / 3600000).toFixed(1);

    console.log(`\n${s.id}  (${prices.length} rows)`);
    console.log(`  updatedAt : oldest=${oldestU.toISOString()}  newest=${newestU.toISOString()}  (newest is ${ageHoursNewestU}h ago)`);
    console.log(`  scrapedAt : oldest=${oldestS.toISOString()}  newest=${newestS.toISOString()}`);
  }

  console.log(`\nServer "now" (this script's clock): ${now.toISOString()}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
