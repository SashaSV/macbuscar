export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, time: new Date().toISOString() });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}