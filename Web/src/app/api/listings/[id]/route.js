import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(_, { params }) {
  try {
    await prisma.listing.update({
      where: { id: parseInt(params.id) },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
