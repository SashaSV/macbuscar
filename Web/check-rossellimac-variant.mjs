// check-rossellimac-variant.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ids = [340, 341, 342, 343];
  for (const id of ids) {
    const v = await prisma.productVariant.findUnique({
      where: { id },
      include: { prices: { where: { storeId: 'rossellimac' } } },
    });
    if (!v) { console.log(`variant ${id}: NOT FOUND`); continue; }
    const p = v.prices[0];
    console.log(`variant ${id} (${v.nombre}):`);
    if (!p) {
      console.log('  NO rossellimac Price row at all');
    } else {
      console.log(`  price=${p.price}  updatedAt=${p.updatedAt.toISOString()}  scrapedAt=${p.scrapedAt.toISOString()}`);
    }
  }

  const count = await prisma.price.count({ where: { storeId: 'rossellimac' } });
  console.log(`\nTotal rossellimac Price rows right now: ${count}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
