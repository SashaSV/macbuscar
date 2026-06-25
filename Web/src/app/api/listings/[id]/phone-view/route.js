// POST /api/listings/[id]/phone-view
//
// Reveals the seller's phone number and bumps the listing's
// phoneViews counter atomically. The full number is NEVER returned by
// any other endpoint — listings are public JSON and we don't want
// scrapers vacuuming up phone numbers — so this is the single path
// the UI uses to unmask the contact.
//
// We use a Prisma `update` with a relative `increment` so two clients
// revealing at the same instant don't race-overwrite each other's
// counters. The endpoint is intentionally fire-and-forget from the
// UI's perspective: if it fails the masked number stays masked, which
// is the safe failure mode.
//
// Returned shape:
//   { telefono: '+34666123456' | null, phoneViews: 12 }
// When the listing has no phone on file, telefono is null and we still
// bump the counter — same intent, same metric, the UI just shows
// "El vendedor no dejó teléfono" instead of digits.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_req, { params }) {
  try {
    const id = parseInt(params.id);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: { phoneViews: { increment: 1 } },
      select: { telefono: true, phoneViews: true },
    });

    return NextResponse.json(listing);
  } catch (err) {
    // P2025 = "Record not found". Return 404 explicitly so the UI can
    // distinguish a stale/deleted listing from a real server error.
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });
    }
    console.error('[POST /api/listings/[id]/phone-view]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
