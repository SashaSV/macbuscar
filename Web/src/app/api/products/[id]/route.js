import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listingHideThreshold } from '@/components/shared/listingLifecycle';

export async function GET(_, { params }) {
  try {
    const id = parseInt(params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        prices: { include: { store: true } },
        reviews: true,
        priceHistory: { orderBy: { createdAt: 'asc' } },
        // Pull the variant's SKU traits along with each Listing so the
        // 2ª-mano cards on the Precios tab can show the configuration
        // ("256GB · Negro · 6.1\"") at a glance AND so the Precios tab
        // can filter listings to the currently-selected variant
        // without an extra round-trip.
        listings: {
          where: {
            active: true,
            // TTL filter: 30 days — see listingLifecycle.js. Keeps the
            // detail view in sync with the listing feed; otherwise a
            // 60-day-old ad would still surface here after the home
            // feed already pruned it, confusing the buyer.
            createdAt: { gte: listingHideThreshold() },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            variant: {
              select: {
                id: true, nombre: true,
                memory: true, ram: true, cpu: true,
                color: true, colorHex: true,
                display: true, screen: true,
                bandSize: true, connectivity: true,
              },
            },
          },
        },
      },
    });

    if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({
      ...product,
      fotos: JSON.parse(product.fotos),
      fotoLabels: JSON.parse(product.fotoLabels),
      specs: JSON.parse(product.specs),
      // Strip telefono from every listing — it's only revealed via
      // POST /api/listings/[id]/phone-view, never in the product
      // payload. Keeps scrapers from sweeping numbers out of the
      // public JSON.
      listings: product.listings.map(({ telefono, ...l }) => ({
        ...l,
        fotos: JSON.parse(l.fotos),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
