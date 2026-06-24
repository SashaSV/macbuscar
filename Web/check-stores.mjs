// Print current Store IDs in production DB so we know exactly which
// IDs to update with appleAuthLevel. Run from Web/:  node check-stores.mjs
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const stores = await p.store.findMany({
  orderBy: { id: 'asc' },
  include: { _count: { select: { prices: true } } },
});

console.log('\nStores currently in DB:\n');
for (const s of stores) {
  console.log(
    `  ${s.id.padEnd(14)} | ${(s.nombre || '').padEnd(22)} | ` +
    `auth=${s.appleAuthLevel ?? 'null'} | prices=${s._count.prices}`
  );
}

await p.$disconnect();
