import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveMultipleFiles } from '@/lib/upload';

// GET /api/listings?productId=1
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    const listings = await prisma.listing.findMany({
      where: {
        active: true,
        ...(productId ? { productId: parseInt(productId) } : {}),
      },
      include: { product: { select: { nombre: true, emoji: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      listings.map(l => ({ ...l, fotos: JSON.parse(l.fotos) }))
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/listings  (multipart/form-data)
export async function POST(request) {
  try {
    const formData = await request.formData();

    const productId = parseInt(formData.get('productoId'));
    const precio    = parseFloat(formData.get('precio'));
    const estado    = formData.get('estado');
    const ciudad    = formData.get('ciudad');
    const vendedor  = formData.get('vendedor');
    const descripcion = formData.get('descripcion') || '';

    // Validate
    if (!productId || !precio || !estado || !ciudad || !vendedor) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
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
        productId,
        precio,
        estado,
        ciudad,
        vendedor,
        descripcion,
        fotos: JSON.stringify(allFotos),
      },
      include: { product: { select: { nombre: true, emoji: true } } },
    });

    return NextResponse.json({ ...listing, fotos: allFotos }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/listings]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
