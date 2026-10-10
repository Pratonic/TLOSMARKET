/**
 * POST /api/admin/judge-scores
 * Admin submits judge scores for top 5 teams.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { judgeScoreSchema } from '@/lib/schemas';



export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = judgeScoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { teamId, judgeName, clarity, justification, answerQuality } = parsed.data;

  await prisma.judgeScore.upsert({
    where: { teamId_judgeName: { teamId, judgeName } },
    update: { clarity, justification, answerQuality },
    create: { teamId, judgeName, clarity, justification, answerQuality },
  });

  return NextResponse.json({ success: true });
}
