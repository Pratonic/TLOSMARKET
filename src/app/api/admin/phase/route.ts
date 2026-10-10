/**
 * POST /api/admin/phase
 * Advances the game phase. Handles portfolio validation, event resolution, and snapshots.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { phaseAdvanceSchema } from '@/lib/schemas';
import { getNextPhase, getPhaseEventCode } from '@/lib/phases';
import { checkMinCompanies, DEFAULT_CONFIG } from '@/lib/engine';
import { getTeamStates } from '@/lib/state';
import { resolveEvent } from '@/lib/resolve';
import { createSnapshots } from '@/lib/snapshot';



export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = phaseAdvanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { force, targetPhase } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: 1 } });
      if (!game) throw new Error('Game not initialized');

      const goodCount = await tx.eventDef.count({ where: { kind: 'GOOD' } });
      const badCount = await tx.eventDef.count({ where: { kind: 'BAD' } });

      let nextPhase = getNextPhase(game.phase, goodCount, badCount);
      if (targetPhase) {
        nextPhase = targetPhase as string;
      }
      if (!nextPhase) throw new Error('Game is already in the final phase');

      // 1. Validation for leaving PORTFOLIO
      if (game.phase === 'PORTFOLIO') {
        const teamStates = await getTeamStates(tx);
        const failingTeams = [];
        for (const team of teamStates) {
          const check = checkMinCompanies(team.holdings, DEFAULT_CONFIG.minCompanies);
          if (!check.valid) {
            failingTeams.push({ name: team.name, count: check.count });
          }
        }

        if (failingTeams.length > 0 && !force) {
          return { error: 'Min companies check failed', failingTeams };
        }

        // Create initial PORTFOLIO snapshot so players see starting prices and balances correctly
        await createSnapshots('PORTFOLIO', tx);
      }

      // 2. Resolve leaving event phase
      const eventCode = getPhaseEventCode(game.phase);
      if (eventCode) {
        await resolveEvent(eventCode, tx);
      }

      // 3. Enter REVEAL / END phase -> create snapshots
      if (['REVEAL_GOOD', 'REVEAL_BAD', 'END'].includes(nextPhase)) {
        await createSnapshots(nextPhase as any, tx);
      }

      // 4. Update Game Phase
      const updated = await tx.game.update({
        where: { id: 1 },
        data: {
          phase: nextPhase,
          gameVersion: { increment: 1 },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: 'ADVANCE_PHASE',
          actor: 'admin',
          details: { from: game.phase, to: nextPhase, force },
        },
      });

      return { success: true, newPhase: updated.phase };
    }, {
      timeout: 60000,
      maxWait: 60000
    });

    if (result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Phase advance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
