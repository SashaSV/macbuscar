// =============================================================
// scripts/migrate-image-paths.mjs
// =============================================================
// After running optimize-images.mjs, update DB image paths from
// .png to .webp for ProductVariant.cover/hover/fotos and
// Product.cover/hover/fotos.
//
// Only touches paths under /products/ or /productscover/ (the dirs
// the optimization script targets). Leaves all other URLs alone.
//
// Usage:
//   node scripts/migrate-image-paths.mjs --dry-run    ← preview
//   node scripts/migrate-image-paths.mjs              ← apply
// =============================================================
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const prisma = new PrismaClient();

const LOCAL_PATH = /^\/(products|productscover)\//;

function rewriteString(value) {
  if (typeof value !== 'string' || !value) return value;
  if (!LOCAL_PATH.test(value)) return value;
  if (!/\.png(\?|$)/i.test(value)) return value;
  return value.replace(/\.png(\?|$)/i, '.webp$1');
}

function rewriteJsonValue(value) {
  // Handles arrays and objects recursively (for fotos JSON columns).
  if (Array.isArray(value)) return value.map(rewriteJsonValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewriteJsonValue(v);
    return out;
  }
  return rewriteString(value);
}

function safeParse(s, fallback) {
  if (Array.isArray(s) || (typeof s === 'object' && s !== null)) return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

let touched = 0;
let scanned = 0;

async function processProducts() {
  const rows = await prisma.product.findMany({
    select: { id: true, slug: true, cover: true, hover: true, fotos: true },
  });
  console.log(`\n📦 Scanning ${rows.length} Products…`);
  for (const r of rows) {
    scanned++;
    const newCover = rewriteString(r.cover);
    const newHover = rewriteString(r.hover);
    const parsedFotos = safeParse(r.fotos, []);
    const rewrittenFotos = rewriteJsonValue(parsedFotos);
    const fotosChanged = JSON.stringify(parsedFotos) !== JSON.stringify(rewrittenFotos);

    const coverChanged = newCover !== r.cover;
    const hoverChanged = newHover !== r.hover;

    if (!coverChanged && !hoverChanged && !fotosChanged) continue;

    touched++;
    console.log(`  · [${r.id}] ${r.slug}`);
    if (coverChanged) console.log(`      cover:  ${r.cover}  →  ${newCover}`);
    if (hoverChanged) console.log(`      hover:  ${r.hover}  →  ${newHover}`);
    if (fotosChanged) {
      const before = JSON.stringify(parsedFotos);
      const after  = JSON.stringify(rewrittenFotos);
      console.log(`      fotos:  (${before.length}b → ${after.length}b, png→webp in ${countDelta(before, after)} entries)`);
    }

    if (!DRY_RUN) {
      await prisma.product.update({
        where: { id: r.id },
        data: {
          cover: newCover,
          hover: newHover,
          fotos: JSON.stringify(rewrittenFotos),
        },
      });
    }
  }
}

async function processVariants() {
  const rows = await prisma.productVariant.findMany({
    select: { id: true, nombre: true, cover: true, hover: true, fotos: true },
  });
  console.log(`\n📦 Scanning ${rows.length} ProductVariants…`);
  for (const r of rows) {
    scanned++;
    const newCover = rewriteString(r.cover);
    const newHover = rewriteString(r.hover);
    // ProductVariant.fotos is a real Json column — no need to parse
    const rewrittenFotos = rewriteJsonValue(r.fotos);
    const fotosChanged = JSON.stringify(r.fotos) !== JSON.stringify(rewrittenFotos);

    const coverChanged = newCover !== r.cover;
    const hoverChanged = newHover !== r.hover;

    if (!coverChanged && !hoverChanged && !fotosChanged) continue;

    touched++;
    console.log(`  · [${r.id}] ${r.nombre}`);
    if (coverChanged) console.log(`      cover:  ${r.cover}  →  ${newCover}`);
    if (hoverChanged) console.log(`      hover:  ${r.hover}  →  ${newHover}`);
    if (fotosChanged) {
      const before = JSON.stringify(r.fotos);
      const after  = JSON.stringify(rewrittenFotos);
      console.log(`      fotos:  png→webp in ${countDelta(before, after)} entries`);
    }

    if (!DRY_RUN) {
      await prisma.productVariant.update({
        where: { id: r.id },
        data: {
          cover: newCover,
          hover: newHover,
          fotos: rewrittenFotos,
        },
      });
    }
  }
}

function countDelta(beforeStr, afterStr) {
  const beforeCount = (beforeStr.match(/\.png/gi) || []).length;
  const afterCount  = (afterStr.match(/\.png/gi) || []).length;
  return beforeCount - afterCount;
}

async function main() {
  console.log('━━━ DB image-path migration ━━━');
  console.log(`  mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}`);
  console.log(`  rule: paths matching /products/* or /productscover/*  ending in .png  →  .webp`);

  try {
    await processProducts();
    await processVariants();
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`  rows scanned: ${scanned}`);
  console.log(`  rows ${DRY_RUN ? 'that would change' : 'updated'}: ${touched}`);
  if (DRY_RUN) console.log('  (re-run without --dry-run to apply)');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
