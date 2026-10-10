/**
 * POST /api/admin/market
 * Toggle trading floor / choices open/close.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { marketToggleSchema } from '@/lib/schemas';



export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = marketToggleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await prisma.game.update({
    where: { id: 1 },
    data: {
      marketOpen: parsed.data.open,
      gameVersion: { increment: 1 },
    },
  });

  return NextResponse.json({ success: true, open: parsed.data.open });
}
