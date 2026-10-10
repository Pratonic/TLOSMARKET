import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { teamNotesSchema } from '@/lib/schemas';



export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'team' || !session.teamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = teamNotesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await prisma.teamNotes.upsert({
    where: { teamId: session.teamId },
    update: parsed.data,
    create: { teamId: session.teamId, ...parsed.data },
  });

  return NextResponse.json({ success: true });
}
