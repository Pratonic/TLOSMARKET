/**
 * POST /api/me/choice
 * Submit an option for the current active event.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { choiceSchema } from '@/lib/schemas';
import { getPhaseEventCode } from '@/lib/phases';



export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'team' || !session.teamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = choiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventId, option } = parsed.data;
  const teamId = session.teamId;

  try {
    const game = await prisma.game.findUnique({ where: { id: 1 } });
    if (!game) throw new Error('Game not initialized');
    if (!game.marketOpen) throw new Error('Market is closed');

    const expectedEventCode = getPhaseEventCode(game.phase);
    if (!expectedEventCode) {
      throw new Error('No active event in the current phase');
    }

    const eventDef = await prisma.eventDef.findUnique({ where: { id: eventId } });
    if (!eventDef) throw new Error('Event not found');

    if (eventDef.code !== expectedEventCode) {
      throw new Error('You can only submit choices for the currently active event');
    }

    // Upsert choice
    await prisma.choice.upsert({
      where: { teamId_eventId: { teamId, eventId } },
      update: { option },
      create: { teamId, eventId, option },
    });

    return NextResponse.json({ success: true, option });
  } catch (error: any) {
    console.error('Choice error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
