export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const safeParse = (s, fallback) => {
  if (Array.isArray(s) || (typeof s === 'object' && s !== null)) return s;
  try { return JSON.parse(s); } catch { return fallback; }
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cat = searchParams.get('cat');
    const q = searchParams.get('q');

    const products = await prisma.product.findMany({
      where: {
        ...(cat && cat !== 'all' ? { cat } : {}),
        ...(q ? { nombre: { contains: q } } : {}),
      },
      include: {
        prices: { include: { store: true } },
        reviews: true,
        priceHistory: { orderBy: { createdAt: 'asc' } },
        listings: { where: { active: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { id: 'asc' },
    });

    const serialized = products.map(p => ({
      ...p,
      fotos: safeParse(p.fotos, []),
      fotoLabels: safeParse(p.fotoLabels, []),
      specs: safeParse(p.specs, {}),
      listings: p.listings.map(l => ({ ...l, fotos: safeParse(l.fotos, []) })),
    }));

    return NextResponse.json(serialized, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}