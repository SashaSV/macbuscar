// =============================================================
// scripts/fix-store-logos.mjs
// =============================================================
// One-shot cleanup of /public/logo/ + Store.logo DB column.
//
// Why: Windows fs is case-insensitive so /logo/mediamarkt.png and
//      /logo/MediaMarkt.png look like the same file locally, but
//      Vercel runs on Linux which is case-sensitive → logos that
//      render fine in dev disappear in prod when the DB column
//      points to lowercase and the file is committed in PascalCase.
//
// What this does:
//   1. Renames git-tracked PascalCase logos to lowercase store.id.
//      Uses a two-step `git mv` (via .tmp filename) because on
//      Windows core.ignorecase=true ignores case-only renames.
//   2. Deletes unused duplicates and orphan files (iStore (K-tuin).png,
//      elcorteinglés.png, rossellimac.png, etc.) via `git rm`.
//   3. Updates Store.logo in DB to canonical /logo/<id>.png so the
//      API serves the right path.
//
// Usage:
//   node scripts/fix-store-logos.mjs --dry-run   ← preview
//   node scripts/fix-store-logos.mjs             ← apply
//
// After: review with `git status`, then commit + push.
// =============================================================
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LOGO_DIR = path.join(ROOT, 'public', 'logo');

const DRY_RUN = process.argv.includes('--dry-run');

// Plan: source filename → action.
//   ['rename', target]  → git mv via temp name (handles case-only changes)
//   ['delete']          → git rm
const PLAN = [
  ['MediaMarkt.png',          'rename', 'mediamarkt.png'],
  ['Worten.png',              'rename', 'worten.png'],
  ['Fnac.png',                'rename', 'fnac.png'],
  ['PcComponentes.jpg',       'delete'],
  ['iStore (K-tuin).png',     'delete'],
  ['El Corte Inglés.png',     'delete'],
  ['elcorteinglés.png',       'delete'],
  ['rossellimac.png',         'delete'],
];

function git(...args) {
  if (DRY_RUN) {
    console.log(`    [dry] git ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`);
    return;
  }
  try {
    execFileSync('git', args, { cwd: ROOT, stdio: 'pipe' });
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    console.log(`    ❌ git ${args.join(' ')}\n       ${stderr.trim()}`);
    throw err;
  }
}

function gitTracked(relPath) {
  try {
    const out = execFileSync('git', ['ls-files', '--error-unmatch', relPath],
      { cwd: ROOT, stdio: 'pipe' });
    return out.toString().trim().length > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('━━━ Store-logo cleanup ━━━');
  console.log(`  mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`  dir:  ${LOGO_DIR}\n`);

  // ─── 1. File operations via git ─────────────────────────────
  for (const [src, action, target] of PLAN) {
    const srcRel = `public/logo/${src}`;
    const srcAbs = path.join(LOGO_DIR, src);

    // Skip silently if neither the working tree nor the index knows it.
    const onDisk  = existsSync(srcAbs);
    const tracked = gitTracked(srcRel);
    if (!onDisk && !tracked) {
      console.log(`   ⏭  ${src}  (not in tree or index — already cleaned up)`);
      continue;
    }

    if (action === 'delete') {
      console.log(`   🗑  ${src}  →  (delete)`);
      // -f because file may already be untracked or partially removed.
      git('rm', '-f', srcRel);
    } else if (action === 'rename') {
      const dstRel = `public/logo/${target}`;
      const tmpRel = `public/logo/__tmp_${target}`;
      console.log(`   ✏  ${src}  →  ${target}`);
      // Two-step to defeat Windows core.ignorecase=true for case-only renames.
      git('mv', '-f', srcRel, tmpRel);
      git('mv', '-f', tmpRel, dstRel);
    }
  }

  // ─── 2. DB updates ──────────────────────────────────────────
  const prisma = new PrismaClient();
  console.log(`\n🗄  Updating Store.logo in DB:`);
  try {
    const stores = await prisma.store.findMany({ select: { id: true, nombre: true, logo: true } });
    let dbChanged = 0;
    for (const s of stores) {
      const want = `/logo/${s.id}.png`;
      if (s.logo === want) {
        console.log(`   ⏭  [${s.id}] already canonical`);
        continue;
      }
      console.log(`   🔁 [${s.id}] '${s.logo}' → '${want}'`);
      if (!DRY_RUN) {
        await prisma.store.update({ where: { id: s.id }, data: { logo: want } });
      }
      dbChanged++;
    }
    console.log(`\n━━━ Summary ━━━`);
    console.log(`  db updates: ${dbChanged} ${DRY_RUN ? '(planned)' : '(applied)'}`);
  } finally {
    await prisma.$disconnect();
  }

  if (DRY_RUN) {
    console.log('\n  Re-run without --dry-run to apply.');
  } else {
    console.log('\n  Next:');
    console.log('    git status                                  # verify rename/delete entries');
    console.log('    git commit -m "Normalize store logo filenames (Vercel case-sensitivity fix)"');
    console.log('    git push');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
