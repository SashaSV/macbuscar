// Apple Store price staleness check.
// Run from Web/:  node check-apple.mjs
//
// Lists every Price row for storeId='apple', sorted oldest updatedAt
// first, with age in days. Since apple.py has no refresh schedule
// (found 2026-07-23 — see TODO.md), this tells us exactly how stale
// each product's official Apple Store price currently is.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const rows = await p.price.findMany({
  where: { storeId: 'apple', discontinued: false },
  include: { variant: { include: { product: true } } },
  orderBy: { updatedAt: 'asc' },
});

const now = Date.now();
const ageDays = (d) => ((now - new Date(d).getTime()) / 86400000);

console.log(`\nApple Store price rows: ${rows.length}\n`);

console.log('Oldest (most stale) first:\n');
console.log(
  `  ${'Product'.padEnd(24)} ${'Variant'.padEnd(30)} ${'Price'.padEnd(9)} ${'Updated'.padEnd(20)} Age(d)`
);
console.log(`  ${'-'.repeat(24)} ${'-'.repeat(30)} ${'-'.repeat(9)} ${'-'.repeat(20)} ------`);

for (const r of rows) {
  const v = r.variant;
  const pname = (v.product?.nombre || '(no product)').slice(0, 24).padEnd(24);
  const vname = (v.nombre || '').slice(0, 30).padEnd(30);
  const price = `${r.price}€`.padEnd(9);
  const upd   = new Date(r.updatedAt).toISOString().slice(0, 16).replace('T', ' ').padEnd(20);
  const age   = ageDays(r.updatedAt).toFixed(1);
  console.log(`  ${pname} ${vname} ${price} ${upd} ${age}`);
}

// Summary buckets
const buckets = { '<1d': 0, '1-3d': 0, '3-7d': 0, '7-14d': 0, '>14d': 0 };
for (const r of rows) {
  const a = ageDays(r.updatedAt);
  if (a < 1) buckets['<1d']++;
  else if (a < 3) buckets['1-3d']++;
  else if (a < 7) buckets['3-7d']++;
  else if (a < 14) buckets['7-14d']++;
  else buckets['>14d']++;
}
console.log('\nAge distribution:');
for (const [k, n] of Object.entries(buckets)) {
  console.log(`  ${k.padEnd(6)} ${n}`);
}

const oldest = rows[0];
const newest = rows[rows.length - 1];
if (oldest) {
  console.log(`\nOldest: ${oldest.variant.product?.nombre} / ${oldest.variant.nombre} — ${ageDays(oldest.updatedAt).toFixed(1)}d ago (${new Date(oldest.updatedAt).toISOString()})`);
}
if (newest) {
  console.log(`Newest: ${newest.variant.product?.nombre} / ${newest.variant.nombre} — ${ageDays(newest.updatedAt).toFixed(1)}d ago (${new Date(newest.updatedAt).toISOString()})`);
}

await p.$disconnect();
