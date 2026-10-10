/**
 * Admin API for managing companies.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCompanySchema, updateCompanySchema } from '@/lib/schemas';



export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: 1 } });
  if (game?.phase !== 'PORTFOLIO') {
    return NextResponse.json({ error: 'Cannot add companies after PORTFOLIO phase' }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: {
      name: parsed.data.name,
      symbol: parsed.data.symbol,
      sector: parsed.data.sector,
      basePrice: parsed.data.basePrice,
      poolSize: parsed.data.poolSize,
    },
  });

  return NextResponse.json({ success: true, company });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const body = await req.json();
  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const company = await prisma.company.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ success: true, company });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const activeCount = await prisma.company.count({ where: { active: true } });
  if (activeCount <= 3) {
    return NextResponse.json({ error: 'Cannot go below 3 active companies' }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: 1 } });
  if (game?.phase !== 'PORTFOLIO') {
    return NextResponse.json({ error: 'Cannot delete companies after PORTFOLIO phase' }, { status: 400 });
  }

  await prisma.company.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
