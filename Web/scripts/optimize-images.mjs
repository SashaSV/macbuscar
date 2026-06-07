// =============================================================
// scripts/optimize-images.mjs
// =============================================================
// Convert PNG images in /public/products and /public/productscover
// to WebP (q=80, max 1200px width). Creates .webp alongside the .png
// without deleting originals by default — safe to re-run.
//
// Phases:
//   1.  node scripts/optimize-images.mjs --dry-run        ← preview
//   2.  node scripts/optimize-images.mjs                  ← create .webp
//   3.  [migrate-image-paths.mjs updates DB]
//   4.  [verify the site renders correctly]
//   5.  node scripts/optimize-images.mjs --move-originals ← move .png out of /public
//      (recommended — keeps raw files locally in Web/_originals-png/,
//       which is gitignored, so they're NOT deployed to Vercel)
//
// Options:
//   --dry-run         report what would change, no writes
//   --move-originals  move .png files to Web/_originals-png/<rel-path>/
//                     (raw files preserved locally, not deployed)
//   --prune-pngs      delete .png files outright (irreversible)
//   --quality <n>     WebP quality (default 80)
//   --max-width <n>   resize cap in pixels (default 1200)
//   --dir <path>      override target dir; can be passed multiple times
//
// Defaults target: public/products + public/productscover.
// =============================================================
import { readdir, stat, unlink, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ─── CLI ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const DRY_RUN         = flag('--dry-run');
const MOVE_ORIGINALS  = flag('--move-originals');
const PRUNE_PNGS      = flag('--prune-pngs');
const QUALITY         = Number(opt('--quality', '80'));
const MAX_WIDTH       = Number(opt('--max-width', '1200'));
const EFFORT          = Number(opt('--effort', '4'));    // 0–6, higher = smaller/sharper but slower

// Destination for archived originals (outside /public so Vercel never sees them).
const ORIGINALS_DIR = path.join(ROOT, '_originals-png');

const userDirs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && args[i + 1]) userDirs.push(args[i + 1]);
}

const DEFAULT_DIRS = [
  path.join(ROOT, 'public', 'products'),
  path.join(ROOT, 'public', 'productscover'),
];
const TARGET_DIRS = userDirs.length ? userDirs.map(d => path.resolve(d)) : DEFAULT_DIRS;

// ─── helpers ───────────────────────────────────────────────────
const fmtBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3)   return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

async function listPngs(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await listPngs(full)));
    } else if (e.isFile() && /\.png$/i.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

// ─── convert one file ──────────────────────────────────────────
async function convertOne(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  const pngStat = await stat(pngPath);
  const pngSize = pngStat.size;

  // Skip if .webp already exists and is newer than the .png
  if (existsSync(webpPath)) {
    const webpStat = await stat(webpPath);
    if (webpStat.mtimeMs >= pngStat.mtimeMs) {
      return { skipped: true, pngSize, webpSize: webpStat.size, webpPath };
    }
  }

  if (DRY_RUN) {
    const img = sharp(pngPath);
    const meta = await img.metadata();
    const willResize = meta.width && meta.width > MAX_WIDTH;
    return {
      dryRun: true,
      pngSize,
      width: meta.width,
      willResize,
      webpPath,
    };
  }

  let pipeline = sharp(pngPath);
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  await pipeline
    .webp({ quality: QUALITY, effort: EFFORT })
    .toFile(webpPath);

  const webpStat = await stat(webpPath);
  return { pngSize, webpSize: webpStat.size, webpPath, width: meta.width };
}

// ─── prune originals (delete) ──────────────────────────────────
async function pruneOne(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  if (!existsSync(webpPath)) {
    return { skipped: true, reason: 'no .webp counterpart' };
  }
  const pngSize = (await stat(pngPath)).size;
  if (DRY_RUN) return { dryRun: true, pngSize };
  await unlink(pngPath);
  return { pngSize };
}

// ─── move originals out of /public (preserve locally) ──────────
async function moveOne(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  if (!existsSync(webpPath)) {
    return { skipped: true, reason: 'no .webp counterpart' };
  }
  const pngSize = (await stat(pngPath)).size;
  // Mirror the path under public/ inside _originals-png/.
  const publicDir = path.join(ROOT, 'public');
  const rel = path.relative(publicDir, pngPath);
  const dest = path.join(ORIGINALS_DIR, rel);
  if (DRY_RUN) {
    return { dryRun: true, pngSize, dest };
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await rename(pngPath, dest);
  return { pngSize, dest };
}

// ─── main ──────────────────────────────────────────────────────
async function main() {
  console.log('━━━ Image optimization ━━━');
  const modeLabel = DRY_RUN
    ? 'DRY RUN (no writes)'
    : MOVE_ORIGINALS
      ? `MOVE .png originals to ${path.relative(ROOT, ORIGINALS_DIR)}/`
      : PRUNE_PNGS
        ? 'PRUNE .png originals (delete)'
        : 'CONVERT .png → .webp';
  console.log(`  mode:      ${modeLabel}`);
  console.log(`  quality:   ${QUALITY}`);
  console.log(`  effort:    ${EFFORT}`);
  console.log(`  max-width: ${MAX_WIDTH}px`);
  console.log(`  dirs:`);
  TARGET_DIRS.forEach(d => console.log(`    · ${d}`));
  console.log('');

  let totalPng = 0;
  let totalWebp = 0;
  let totalConverted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const dir of TARGET_DIRS) {
    if (!existsSync(dir)) {
      console.log(`⚠️  Skip ${dir} (does not exist)`);
      continue;
    }
    const pngs = await listPngs(dir);
    console.log(`📂 ${path.relative(ROOT, dir) || dir}: ${pngs.length} .png files`);

    for (const png of pngs) {
      const rel = path.relative(ROOT, png);
      try {
        if (MOVE_ORIGINALS) {
          const r = await moveOne(png);
          if (r.skipped) {
            console.log(`   ⏭  ${rel}  (${r.reason})`);
            totalSkipped++;
          } else {
            const destRel = path.relative(ROOT, r.dest);
            console.log(`   ${DRY_RUN ? '🔍' : '📦'} ${rel}  →  ${destRel}  (${fmtBytes(r.pngSize)})`);
            totalConverted++;
            totalPng += r.pngSize;
          }
        } else if (PRUNE_PNGS) {
          const r = await pruneOne(png);
          if (r.skipped) {
            console.log(`   ⏭  ${rel}  (${r.reason})`);
            totalSkipped++;
          } else {
            console.log(`   ${DRY_RUN ? '🔍' : '🗑 '} ${rel}  (was ${fmtBytes(r.pngSize)})`);
            totalConverted++;
            totalPng += r.pngSize;
          }
        } else {
          const r = await convertOne(png);
          if (r.skipped) {
            console.log(`   ⏭  ${rel}  (already converted, ${fmtBytes(r.webpSize)})`);
            totalSkipped++;
            totalPng += r.pngSize;
            totalWebp += r.webpSize;
          } else if (r.dryRun) {
            console.log(`   🔍 ${rel}  (${fmtBytes(r.pngSize)}, ${r.width || '?'}px${r.willResize ? ' → ' + MAX_WIDTH + 'px' : ''})`);
            totalConverted++;
            totalPng += r.pngSize;
          } else {
            const pct = (100 * (1 - r.webpSize / r.pngSize)).toFixed(1);
            console.log(`   ✅ ${rel}  ${fmtBytes(r.pngSize)} → ${fmtBytes(r.webpSize)}  (−${pct}%)`);
            totalConverted++;
            totalPng += r.pngSize;
            totalWebp += r.webpSize;
          }
        }
      } catch (err) {
        console.log(`   ❌ ${rel}: ${err.message}`);
        totalErrors++;
      }
    }
    console.log('');
  }

  console.log('━━━ Summary ━━━');
  console.log(`  processed: ${totalConverted}`);
  console.log(`  skipped:   ${totalSkipped}`);
  console.log(`  errors:    ${totalErrors}`);
  if (MOVE_ORIGINALS) {
    console.log(`  ${DRY_RUN ? 'would move' : 'moved'}: ${fmtBytes(totalPng)} of .png originals → ${path.relative(ROOT, ORIGINALS_DIR)}/`);
  } else if (PRUNE_PNGS) {
    console.log(`  ${DRY_RUN ? 'would delete' : 'deleted'}: ${fmtBytes(totalPng)} of .png originals`);
  } else if (totalWebp > 0) {
    const pct = (100 * (1 - totalWebp / totalPng)).toFixed(1);
    console.log(`  png total:  ${fmtBytes(totalPng)}`);
    console.log(`  webp total: ${fmtBytes(totalWebp)}`);
    console.log(`  saved:      ${fmtBytes(totalPng - totalWebp)}  (−${pct}%)`);
  } else {
    console.log(`  png total: ${fmtBytes(totalPng)}  (no webps written in dry-run)`);
  }
  console.log('');

  if (!MOVE_ORIGINALS && !PRUNE_PNGS && !DRY_RUN) {
    console.log('Next steps:');
    console.log('  1.  customCover.js already auto-detects .webp (done)');
    console.log('  2.  Run scripts/migrate-image-paths.mjs to update DB paths');
    console.log('  3.  npm run dev — verify the site renders');
    console.log('  4.  When happy: node scripts/optimize-images.mjs --move-originals');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
