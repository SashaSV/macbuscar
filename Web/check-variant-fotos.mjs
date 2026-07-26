// check-variant-fotos.mjs
// The product-detail "Precios" tab shows a LEFT photo using
// selectedVariant.fotos (falling back to prod.fotos only if empty).
// The bottom "Galería" tab always uses prod.fotos (the group photo),
// which the user confirms IS showing. So the bug is specifically in
// ProductVariant.fotos — either empty, still .png, or pointing at a
// file that doesn't actually exist on disk.
//
// This checks the raw `fotos` field per variant AND verifies each
// referenced file actually exists under Web/public.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const PUBLIC_DIR = path.join(process.cwd(), 'public');

function parseFotos(f) {
  try { return typeof f === 'string' ? JSON.parse(f) : (f || []); }
  catch { return []; }
}

async function main() {
  const cats = ['iphone', 'ipad', 'mac', 'airpods', 'watch'];
  for (const cat of cats) {
    const products = await prisma.product.findMany({
      where: { cat },
      take: 2,
      include: { variants: { take: 3 } },
    });
    console.log(`\n=== cat=${cat} ===`);
    for (const p of products) {
      for (const v of p.variants) {
        const fotos = parseFotos(v.fotos);
        console.log(`Variant [${v.id}] ${v.nombre}: fotos=${JSON.stringify(fotos)}`);
        for (const f of fotos) {
          const rel = f.startsWith('/') ? f.slice(1) : f;
          const full = path.join(PUBLIC_DIR, rel);
          const exists = fs.existsSync(full);
          console.log(`    ${exists ? '✅' : '❌ MISSING'}  ${f}`);
        }
        if (!fotos.length) console.log('    (empty fotos array)');
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
