// =============================================================
// scripts/fix-store-logos.mjs
// =============================================================
// One-shot cleanup of /public/logo/ + Store.logo DB column.
//
// Problem: Windows is case-insensitive so /logo/mediamarkt.png and
//          /logo/MediaMarkt.png look like the same file locally, but
//          Vercel runs on Linux which is case-sensitive → logos that
//          render fine in dev disappear in prod.
//
// Solution: normalize every file to lowercase = store.id, and set
//           Store.logo = '/logo/${store.id}.png' for every row.
//
// Usage:
//   node scripts/fix-store-logos.mjs --dry-run   ← preview
//   node scripts/fix-store-logos.mjs             ← apply
// =============================================================
import { readdir, rename, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LOGO_DIR = path.join(ROOT, 'public', 'logo');

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

// Map every variant of a logo filename we've seen → canonical lowercase id.
const FILE_TO_ID = {
  'amazon.png':                'amazon',
  'apple.png':                 'apple',
  'mediamarkt.png':            'mediamarkt',
  'MediaMarkt.png':            'mediamarkt',
  'pccomp.png':                'pccomp',
  'PcComponentes.jpg':         'pccomp',
  'fnac.png':                  'fnac',
  'Fnac.png':                  'fnac',
  'elcorte.png':               'elcorte',
  'El Corte Inglés.png':       'elcorte',
  'worten.png':                'worten',
  'Worten.png':                'worten',
  'istore.png':                'istore',
  'iStore (K-tuin).png':       'istore',
  'rossellimac.png':           null,    // no such store in seed — delete
};

async function main() {
  console.log('━━━ Store-logo cleanup ━━━');
  console.log(`  mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`  dir:  ${LOGO_DIR}\n`);

  // 1. Walk the dir, plan a rename/delete for each file.
  const files = await readdir(LOGO_DIR);
  const planByTarget = {};          // canonical-name → first source seen
  const actions = [];               // {src, action, target?}

  for (const f of files) {
    const id = FILE_TO_ID[f];
    if (id === undefined) {
      console.log(`   ⚠️  Unknown file ${f} — leaving alone (add to FILE_TO_ID if needed)`);
      continue;
    }
    if (id === null) {
      actions.push({ src: f, action: 'delete' });
      continue;
    }
    const target = `${id}.png`;
    if (!planByTarget[target]) {
      // First contender for this canonical name → use it.
      planByTarget[target] = f;
      if (f !== target) actions.push({ src: f, action: 'rename', target });
    } else {
      // Already have a canonical for this id → this one is a duplicate.
      actions.push({ src: f, action: 'delete', reason: `duplicate of ${planByTarget[target]} → ${target}` });
    }
  }

  console.log(`\n📋 Planned ${actions.length} file action(s):`);
  for (const a of actions) {
    if (a.action === 'rename') {
      console.log(`   ✏  ${a.src}  →  ${a.target}`);
    } else {
      console.log(`   🗑  ${a.src}  ${a.reason ? `(${a.reason})` : ''}`);
    }
  }

  if (!DRY_RUN) {
    for (const a of actions) {
      const src = path.join(LOGO_DIR, a.src);
      if (!existsSync(src)) continue;
      if (a.action === 'rename') {
        const dst = path.join(LOGO_DIR, a.target);
        // If a different file already sits at the canonical name, remove it first.
        if (existsSync(dst)) await unlink(dst);
        await rename(src, dst);
      } else if (a.action === 'delete') {
        await unlink(src);
      }
    }
  }

  // 2. Update Store.logo in DB to canonical /logo/<id>.png for every store.
  console.log(`\n🗄  Updating Store.logo in DB:`);
  const stores = await prisma.store.findMany({ select: { id: true, nombre: true, logo: true } });
  let dbChanged = 0;
  for (const s of stores) {
    const want = `/logo/${s.id}.png`;
    if (s.logo === want) {
      console.log(`   ⏭  [${s.id}] ${s.nombre}  already canonical`);
      continue;
    }
    console.log(`   🔁 [${s.id}] ${s.nombre}  '${s.logo}' → '${want}'`);
    if (!DRY_RUN) {
      await prisma.store.update({ where: { id: s.id }, data: { logo: want } });
    }
    dbChanged++;
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  file actions:  ${actions.length} ${DRY_RUN ? '(planned)' : '(applied)'}`);
  console.log(`  db updates:    ${dbChanged} ${DRY_RUN ? '(planned)' : '(applied)'}`);
  if (DRY_RUN) console.log('\n  Re-run without --dry-run to apply.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
