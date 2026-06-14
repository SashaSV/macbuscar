/**
 * POST /api/products/[id]/view
 *
 * Atomically increment Product.views. Called from ModalProducto's
 * useEffect on open, fire-and-forget — we don't gate the UI on its
 * success. The increment is per-modal-open (one per opened modal),
 * not per-IP/session — simple by design. If we later need to fight
 * bot/click inflation we can layer a same-IP-per-hour dedupe table
 * here, but for the current traffic level the raw counter is fine
 * and easy to reason about.
 *
 * Returns { id, views } so the caller can update its in-memory copy
 * of the product card without a full reload.
 *
 * No body, no auth — anyone hitting the endpoint can bump the counter
 * for any product. This is consistent with how view counters work on
 * every other product-listing site; the metric is "how interesting did
 * the link look", not "how many unique humans actually read".
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_, { params }) {
  try {
    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Bad product id' }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { views: { increment: 1 } },
      select: { id: true, views: true },
    });

    return NextResponse.json(product, {
      // Don't let any CDN cache this — it's a write op.
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    // The most common failure here is "product not found" (P2025) when a
    // stale modal tries to increment a deleted product. Return 404 in
    // that case; everything else gets a generic 500 with the message.
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    console.error('[POST /api/products/[id]/view]', err);
    return NextResponse.json({ error: 'Error al registrar vista', message: err.message }, { status: 500 });
  }
}
