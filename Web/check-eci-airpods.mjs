// What ECI matched on AirPods today, vs what's in DB total.
// Run from Web/: node check-eci-airpods.mjs
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const allAirpods = await p.productVariant.findMany({
  where: { product: { cat: 'airpods' } },
  include: { product: true, prices: { where: { storeId: 'elcorte' } } },
});

console.log('\n=== All AirPods variants in DB ===');
console.log(`Total: ${allAirpods.length}\n`);

const grouped = {};
for (const v of allAirpods) {
  const key = v.product.nombre;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(v);
}

for (const [name, variants] of Object.entries(grouped)) {
  const matched = variants.filter(v => v.prices.length > 0).length;
  const status = matched === variants.length ? '✅' : matched > 0 ? '🟡' : '❌';
  console.log(`${status} ${name.padEnd(22)} ECI: ${matched}/${variants.length}`);
  for (const v of variants) {
    const eci = v.prices[0];
    const tag = eci ? `${eci.price} EUR  ${eci.url || ''}` : '—';
    const color = (v.color || '(no color)').padEnd(32);
    const memory = (v.memory || '').padEnd(8);
    console.log(`     ${color} ${memory} = ${tag}`);
  }
  console.log('');
}

await p.$disconnect();
