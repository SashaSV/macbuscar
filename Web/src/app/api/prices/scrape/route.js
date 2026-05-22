export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapePrice } from '@/lib/scraper';

/**
 * POST /api/prices/scrape
 * Body: { productId?: number }   — omit to scrape all products
 *
 * Scrapes prices AND product URLs for all stores, saves both to DB.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { productId } = body;

    const products = await prisma.product.findMany({
      where: productId ? { id: parseInt(productId) } : undefined,
      include: { prices: { include: { store: true } } },
    });

    const results = [];

    for (const product of products) {
      const storeResults = {};

      await Promise.all(
        product.prices.map(async ({ store, price: basePrice, url: oldUrl }) => {
          const { price, url, status, error, duration } = await scrapePrice(store.id, product.nombre);

          await prisma.scrapingLog.create({
            data: { storeId: store.id, productId: product.id, status, price, error, duration },
          });

          if (price) {
            await prisma.price.update({
              where: { productId_storeId: { productId: product.id, storeId: store.id } },
              data: { price, url: url || oldUrl },
            });
            storeResults[store.id] = { price, url: url || oldUrl, status };
          } else {
            storeResults[store.id] = { price: basePrice, url: oldUrl, status };
          }
        })
      );

      results.push({ productId: product.id, nombre: product.nombre, stores: storeResults });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('[POST /api/prices/scrape]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — fetch latest prices for all products
export async function GET() {
  try {
    const prices = await prisma.price.findMany({ include: { store: true } });
    const grouped = prices.reduce((acc, p) => {
      if (!acc[p.productId]) acc[p.productId] = {};
      acc[p.productId][p.storeId] = { price: p.price, url: p.url };
      return acc;
    }, {});
    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}