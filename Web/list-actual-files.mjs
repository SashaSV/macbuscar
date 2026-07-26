// list-actual-files.mjs
// The DB fotos/cover for iphone/ipad/mac variants point at
// *-finish-select-*_AV1_<hash>.webp / *-size-select-*_AV1_<hash>.webp
// files that don't exist. List what ACTUALLY exists in public/products
// for a few name prefixes, to see if it's a hash mismatch (file exists
// under a different hash) or the files were never saved at all.
import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'public', 'products');
const all = fs.readdirSync(DIR);
console.log(`Total files in public/products: ${all.length}`);

const prefixes = [
  'iphone-17-pro-finish-select',
  'iphone-air-finish-select',
  'ipad-pro-finish-select',
  'ipad-air-finish-select',
  'mac-macbook-pro-size-select',
  'macbook-air-size-select',
];

for (const pre of prefixes) {
  const matches = all.filter(f => f.startsWith(pre));
  console.log(`\nPrefix "${pre}": ${matches.length} matches`);
  matches.slice(0, 10).forEach(f => console.log('   ' + f));
}

// Also check _originals-png for these in case they never got converted/moved
const origDir = path.join(process.cwd(), '_originals-png');
if (fs.existsSync(origDir)) {
  const origAll = fs.readdirSync(origDir);
  console.log(`\nTotal files in _originals-png: ${origAll.length}`);
  for (const pre of prefixes) {
    const matches = origAll.filter(f => f.startsWith(pre));
    if (matches.length) {
      console.log(`Prefix "${pre}" found in _originals-png: ${matches.length}`);
      matches.slice(0, 5).forEach(f => console.log('   ' + f));
    }
  }
} else {
  console.log('\n(no _originals-png dir found at', origDir, ')');
}
