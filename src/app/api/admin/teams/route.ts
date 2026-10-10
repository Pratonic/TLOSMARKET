/**
 * GET/POST/DELETE Teams
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createTeamSchema } from '@/lib/schemas';



export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { name, username, password } = parsed.data;

  const existing = await prisma.team.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const team = await prisma.team.create({
      data: { name, username, passwordHash },
    });
    return NextResponse.json({ success: true, teamId: team.id });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Database error adding team' }, { status: 500 });
  }
}
