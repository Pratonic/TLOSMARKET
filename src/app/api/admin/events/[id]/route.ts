/**
 * Admin API for managing events and per-company parameters.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateEventSchema } from '@/lib/schemas';


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const body = await req.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const event = await prisma.eventDef.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.resolved) return NextResponse.json({ error: 'Cannot edit resolved events' }, { status: 400 });

  const { title, questionText, companies } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (title || questionText) {
      await tx.eventDef.update({
        where: { id },
        data: {
          title: title || undefined,
          questionText: questionText || undefined,
        },
      });
    }

    if (companies) {
      for (const comp of companies) {
        await tx.eventCompany.update({
          where: { eventId_companyId: { eventId: id, companyId: comp.companyId } },
          data: {
            aggressiveMove: comp.aggressiveMove || undefined,
            moderateMove: comp.moderateMove || undefined,
            holdDrop: comp.holdDrop || undefined,
          },
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const event = await prisma.eventDef.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.resolved) return NextResponse.json({ error: 'Cannot delete resolved events' }, { status: 400 });

  await prisma.eventDef.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
