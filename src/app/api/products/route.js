import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Serialize JSON fields
    const serialized = products.map(p => ({
      ...p,
      fotos: JSON.parse(p.fotos),
      fotoLabels: JSON.parse(p.fotoLabels),
      specs: JSON.parse(p.specs),
      listings: p.listings.map(l => ({ ...l, fotos: JSON.parse(l.fotos) })),
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}
