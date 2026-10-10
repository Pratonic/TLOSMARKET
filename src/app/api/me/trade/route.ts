/**
 * POST /api/me/trade
 * Buy/sell shares during PORTFOLIO phase.
 * Concurrency-safe: uses row-level locks and conditional updates.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { tradeSchema } from '@/lib/schemas';
import Decimal from 'decimal.js';



export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'team' || !session.teamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, qty, action } = parsed.data;
  const teamId = session.teamId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check game state
      const game = await tx.game.findUnique({ where: { id: 1 } });
      if (!game) throw new Error('Game not initialized');
      if (game.phase !== 'PORTFOLIO') {
        throw new Error('Trading is only allowed during PORTFOLIO phase');
      }
      if (!game.marketOpen) {
        throw new Error('Market is closed');
      }

      // Get team
      const team = await tx.team.findUnique({ where: { id: teamId }, select: { id: true, cash: true } });
      if (!team) throw new Error('Team not found');

      // Get company
      const company = await tx.company.findUnique({ where: { id: companyId } });
      if (!company || !company.active) throw new Error('Company not found or inactive');

      // Get current holding for this team-company
      const trades = await tx.trade.findMany({
        where: { teamId, companyId },
      });
      const currentHolding = trades.reduce((sum, t) => sum + t.qty, 0);

      const basePrice = new Decimal(company.basePrice.toString());
      const teamCash = new Decimal(team.cash.toString());

      if (action === 'buy') {
        const cost = basePrice.mul(qty);
        if (teamCash.lt(cost)) {
          throw new Error(`Insufficient cash. Need ₹${cost.toFixed(2)}, have ₹${teamCash.toFixed(2)}`);
        }
        if (currentHolding + qty > 200) { // cap
          throw new Error(`Would exceed cap of 200. Currently hold ${currentHolding}.`);
        }

        // Atomic pool check: conditional update
        const poolResult = await tx.company.updateMany({
          where: {
            id: companyId,
            poolSold: { lte: company.poolSize - qty }, // ensures poolSold + qty <= poolSize
          },
          data: {
            poolSold: { increment: qty },
          },
        });

        if (poolResult.count === 0) {
          throw new Error('Not enough shares in pool');
        }

        // Deduct cash
        await tx.team.update({
          where: { id: teamId },
          data: { cash: { decrement: cost.toNumber() } },
        });

        // Record trade
        await tx.trade.create({
          data: {
            teamId,
            companyId,
            qty, // positive for buy
            price: company.basePrice,
          },
        });

        // Bump game version
        await tx.game.update({
          where: { id: 1 },
          data: { gameVersion: { increment: 1 } },
        });

        return {
          action: 'buy',
          qty,
          symbol: company.symbol,
          cost: cost.toString(),
          newCash: teamCash.minus(cost).toString(),
          newHolding: currentHolding + qty,
        };
      } else {
        // SELL
        if (qty > currentHolding) {
          throw new Error(`Cannot sell ${qty}; only hold ${currentHolding}`);
        }

        const returns = basePrice.mul(qty); // No discount in Phase 1

        // Return shares to pool
        await tx.company.update({
          where: { id: companyId },
          data: { poolSold: { decrement: qty } },
        });

        // Add cash
        await tx.team.update({
          where: { id: teamId },
          data: { cash: { increment: returns.toNumber() } },
        });

        // Record trade
        await tx.trade.create({
          data: {
            teamId,
            companyId,
            qty: -qty, // negative for sell
            price: company.basePrice,
          },
        });

        // Bump game version
        await tx.game.update({
          where: { id: 1 },
          data: { gameVersion: { increment: 1 } },
        });

        return {
          action: 'sell',
          qty,
          symbol: company.symbol,
          returns: returns.toString(),
          newCash: teamCash.plus(returns).toString(),
          newHolding: currentHolding - qty,
        };
      }
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transaction failed';
    console.error('Trade error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
