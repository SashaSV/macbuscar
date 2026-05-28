export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveMultipleFiles } from '@/lib/upload';

// In the schema, Listing is linked ONLY to ProductVariant.
// The product is reached through variant -> product.
const VARIANT_INCLUDE = {
  variant: {
    select: {
      id: true, nombre: true, color: true, colorHex: true, memory: true,
      productId: true,
      product: { select: { id: true, nombre: true, emoji: true, slug: true } },
    },
  },
};

// GET /api/listings?productId=1
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    const listings = await prisma.listing.findMany({
      where: {
        active: true,
        // filter by product through the variant relation
        ...(productId ? { variant: { productId: parseInt(productId) } } : {}),
      },
      include: VARIANT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      listings.map(l => ({
        ...l,
        fotos: JSON.parse(l.fotos),
        // expose product at top level for backwards compatibility with the UI
        product: l.variant?.product || null,
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/listings  (multipart/form-data)
export async function POST(request) {
  try {
    const formData = await request.formData();

    const productId = formData.get('productoId') ? parseInt(formData.get('productoId')) : null;
    const variantId = formData.get('variantId') ? parseInt(formData.get('variantId')) : null;
    const precio    = parseFloat(formData.get('precio'));
    const estado    = formData.get('estado');
    const ciudad    = formData.get('ciudad');
    const vendedor  = formData.get('vendedor');
    const descripcion = formData.get('descripcion') || '';

    // variantId is required — Listing is tied to a specific SKU (variant)
    if (!variantId || !precio || !estado || !ciudad || !vendedor) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Safety: make sure the variant exists (and, if productId was sent, that it matches)
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true },
    });
    if (!variant) {
      return NextResponse.json({ error: 'La variante no existe' }, { status: 400 });
    }
    if (productId && variant.productId !== productId) {
      return NextResponse.json({ error: 'La variante no corresponde al producto' }, { status: 400 });
    }

    // Handle uploaded files
    const uploadedPaths = await saveMultipleFiles(formData, 'fotos');

    // Handle URL photos (sent as fotos_url_0, fotos_url_1…)
    const urlPhotos = [];
    for (let i = 0; i < 5; i++) {
      const url = formData.get(`fotos_url_${i}`);
      if (url) urlPhotos.push(url);
    }

    const allFotos = [...uploadedPaths, ...urlPhotos].slice(0, 5);

    const listing = await prisma.listing.create({
      data: {
        variant: { connect: { id: variantId } },
        precio,
        estado,
        ciudad,
        vendedor,
        descripcion,
        fotos: JSON.stringify(allFotos),
      },
      include: VARIANT_INCLUDE,
    });

    return NextResponse.json(
      { ...listing, fotos: allFotos, product: listing.variant?.product || null },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/listings]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
