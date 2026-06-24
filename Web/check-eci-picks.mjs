// Find best ECI products to verify on live site.
// Picks rows with strikethrough discount (most visible on UI) +
// across different categories so we test more than just iPhone.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const rows = await p.price.findMany({
  where: {
    storeId: 'elcorte',
    oldPrice: { not: null },
  },
  include: { variant: { include: { product: true } } },
  orderBy: { discountPct: 'desc' },
});

// Pick one per category (highest discount first)
const seen = new Set();
const picks = [];
for (const r of rows) {
  const cat = r.variant.product?.cat;
  if (!cat || seen.has(cat)) continue;
  seen.add(cat);
  picks.push(r);
}

console.log('\nBest ECI verification candidates (one per category):\n');
for (const r of picks) {
  const v = r.variant;
  const prod = v.product;
  const disc = r.oldPrice ? Math.round((1 - r.price / r.oldPrice) * 100) : 0;
  console.log(`[${prod.cat.padEnd(7)}] ${prod.nombre} - ${v.color || ''} ${v.memory || ''}`);
  console.log(`           Product slug:  /producto/${prod.slug}`);
  console.log(`           ECI price:     ${r.price} EUR  (was ${r.oldPrice} EUR, -${disc}%)`);
  console.log(`           ECI url:       ${r.url}`);
  console.log('');
}

await p.$disconnect();
