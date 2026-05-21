export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VERSION = "v3-safeparse-" + Date.now();

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

    const serialized = products.map(p => {
      const fotos = safeParse(p.fotos, []);
      const fotoLabels = safeParse(p.fotoLabels, []);
      const specs = safeParse(p.specs, {});
      return {
        id: p.id,
        slug: p.slug,
        nombre: p.nombre,
        cat: p.cat,
        emoji: p.emoji,
        rating: p.rating,
        tag: p.tag,
        desc: p.desc,
        fotos,
        fotoLabels,
        specs,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        prices: p.prices,
        reviews: p.reviews,
        priceHistory: p.priceHistory,
        listings: p.listings.map(l => ({
          id: l.id,
          productId: l.productId,
          precio: l.precio,
          estado: l.estado,
          ciudad: l.ciudad,
          vendedor: l.vendedor,
          descripcion: l.descripcion,
          fotos: safeParse(l.fotos, []),
          active: l.active,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        })),
      };
    });

    return NextResponse.json(serialized, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}