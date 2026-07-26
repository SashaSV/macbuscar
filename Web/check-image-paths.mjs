// check-image-paths.mjs
// Sample a few variants from each category to see their current
// cover/hover/fotos paths, so we can tell whether the "photos missing
// everywhere except Apple Watch" symptom is a png-vs-webp mismatch
// (like the 25 Mac rows fixed via migrate-image-paths.mjs) or
// something else (broken path entirely, empty fotos, etc).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cats = ['iphone', 'ipad', 'mac', 'airpods', 'watch'];
  for (const cat of cats) {
    const products = await prisma.product.findMany({
      where: { cat },
      take: 2,
      include: { variants: { take: 2 } },
    });
    console.log(`\n=== cat=${cat} ===`);
    for (const p of products) {
      console.log(`Product [${p.id}] ${p.nombre}: cover=${p.cover}`);
      for (const v of p.variants) {
        console.log(`  Variant [${v.id}] ${v.nombre}: cover=${v.cover}`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
