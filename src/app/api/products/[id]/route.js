import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_, { params }) {
  try {
    const id = parseInt(params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        prices: { include: { store: true } },
        reviews: true,
        priceHistory: { orderBy: { createdAt: 'asc' } },
        listings: { where: { active: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({
      ...product,
      fotos: JSON.parse(product.fotos),
      fotoLabels: JSON.parse(product.fotoLabels),
      specs: JSON.parse(product.specs),
      listings: product.listings.map(l => ({ ...l, fotos: JSON.parse(l.fotos) })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
