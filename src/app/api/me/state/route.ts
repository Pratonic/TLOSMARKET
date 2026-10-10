/**
 * GET /api/me/state
 * Returns the player's visible state based on current phase.
 * Uses snapshots for revealed data, never exposes raw admin state.
 * Supports ETag/304 via gameVersion.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { getPlayerVisibleMilestone, getPhaseEventCode } from '@/lib/phases';



export async function GET(req: NextRequest) {
  try {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'team' || !session.teamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const game = await prisma.game.findUnique({ where: { id: 1 } });
  if (!game) {
    return NextResponse.json({ error: 'Game not initialized' }, { status: 500 });
  }

  // ETag support
  const etag = `"v${game.gameVersion}"`;
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const goodCount = await prisma.eventDef.count({ where: { kind: 'GOOD' } });
  const badCount = await prisma.eventDef.count({ where: { kind: 'BAD' } });

  const phase = game.phase as string;
  const milestone = getPlayerVisibleMilestone(phase, goodCount, badCount);

  // Run independent queries in parallel to avoid Neon latency stacking
  const [team, snapshot, notes, allCompanies] = await Promise.all([
    prisma.team.findUnique({
      where: { id: session.teamId },
      select: { id: true, name: true, username: true, cash: true },
    }),
    prisma.snapshot.findUnique({
      where: { teamId_milestone: { teamId: session.teamId, milestone } },
      include: { holdings: { include: { company: { select: { name: true, symbol: true, sector: true } } } } },
    }),
    prisma.teamNotes.findUnique({
      where: { teamId: session.teamId },
    }),
    phase === 'PORTFOLIO' ? prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true, symbol: true, sector: true, basePrice: true, poolSize: true, poolSold: true },
    }) : Promise.resolve([])
  ]);

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // If END phase, also load full report data
  let report = null;
  if (phase === 'END') {
    const endSnapshot = await prisma.snapshot.findUnique({
      where: { teamId_milestone: { teamId: session.teamId, milestone: 'END' } },
      include: { holdings: { include: { company: { select: { name: true, symbol: true, sector: true } } } } },
    });
    if (endSnapshot) {
      report = {
        cash: endSnapshot.cash.toString(),
        netWorth: endSnapshot.netWorth.toString(),
        holdings: endSnapshot.holdings.map(h => ({
          companyName: h.company.name,
          symbol: h.company.symbol,
          sector: h.company.sector,
          shares: h.shares,
          price: h.price.toString(),
          value: h.price.toNumber() * h.shares,
        })),
      };
    }
  }

  // Get current event if in an event phase
  let currentEvent = null;
  const eventCode = getPhaseEventCode(phase);

  if (eventCode) {
    const eventDef = await prisma.eventDef.findUnique({
      where: { code: eventCode },
      include: {
        eventCompanies: {
          include: { company: { select: { id: true, name: true, symbol: true, sector: true } } },
        },
      },
    });

    if (eventDef) {
      // Get team's current choice for this event
      const choice = await prisma.choice.findUnique({
        where: { teamId_eventId: { teamId: session.teamId, eventId: eventDef.id } },
      });

      // Get team's current holdings for affected companies
      // We need trades to compute holdings
      const trades = await prisma.trade.findMany({
        where: { teamId: session.teamId },
      });

      const holdingsMap = new Map<string, number>();
      for (const t of trades) {
        holdingsMap.set(t.companyId, (holdingsMap.get(t.companyId) || 0) + t.qty);
      }

      const affectedCompanies = eventDef.eventCompanies
        .filter(ec => (holdingsMap.get(ec.companyId) || 0) > 0)
        .map(ec => ({
          companyId: ec.company.id,
          name: ec.company.name,
          symbol: ec.company.symbol,
          sector: ec.company.sector,
          sharesHeld: holdingsMap.get(ec.companyId) || 0,
          // NEVER expose: aggressiveMove, moderateMove, holdDrop, fees, deltas
        }));

      currentEvent = {
        eventId: eventDef.id,
        code: eventDef.code,
        kind: eventDef.kind,
        title: eventDef.title,
        questionText: eventDef.questionText,
        // ONLY labels, never percentages
        options: eventDef.kind === 'GOOD'
          ? ['AGGRESSIVE', 'MODERATE', 'PASS']
          : ['HOLD', 'SELL_HALF', 'EXIT'],
        affectedCompanies,
        currentChoice: choice?.option || null,
      };
    }
  }

  // Build holdings from snapshot or from trades (for PORTFOLIO phase)
  let holdings;
  if (snapshot) {
    holdings = snapshot.holdings.map(h => ({
      companyId: h.companyId,
      companyName: h.company.name,
      symbol: h.company.symbol,
      sector: h.company.sector,
      shares: h.shares,
      price: h.price.toString(),
      value: (h.price.toNumber() * h.shares).toString(),
    }));
  } else {
    // Compute from trades (PORTFOLIO phase)
    const trades = await prisma.trade.findMany({
      where: { teamId: session.teamId },
      include: { company: { select: { name: true, symbol: true, sector: true, basePrice: true } } },
    });

    const holdingsMap = new Map<string, { shares: number; company: { name: string; symbol: string; sector: string; basePrice: any } }>();
    for (const t of trades) {
      const existing = holdingsMap.get(t.companyId);
      if (existing) {
        existing.shares += t.qty;
      } else {
        holdingsMap.set(t.companyId, { shares: t.qty, company: t.company });
      }
    }

    // Also include all companies with 0 shares for the portfolio view
    // (allCompanies already fetched in parallel above)

    holdings = allCompanies.map(c => {
      const h = holdingsMap.get(c.id);
      return {
        companyId: c.id,
        companyName: c.name,
        symbol: c.symbol,
        sector: c.sector,
        shares: h?.shares || 0,
        price: c.basePrice.toString(),
        value: ((h?.shares || 0) * c.basePrice.toNumber()).toString(),
        poolRemaining: phase === 'PORTFOLIO' ? c.poolSize - c.poolSold : undefined,
        poolSize: phase === 'PORTFOLIO' ? c.poolSize : undefined,
      };
    });
  }

  // Cash displayed to player: from snapshot if available, else from team record
  const displayCash = snapshot ? snapshot.cash.toString() : team.cash.toString();
  const displayNetWorth = snapshot ? snapshot.netWorth.toString()
    : holdings.reduce((sum, h) => sum + parseFloat(h.value), parseFloat(displayCash)).toString();

  // Team notes already fetched in parallel at the top

  const response = NextResponse.json({
    gameVersion: game.gameVersion,
    phase,
    marketOpen: game.marketOpen,
    team: {
      id: team.id,
      name: team.name,
    },
    cash: displayCash,
    netWorth: displayNetWorth,
    holdings,
    currentEvent,
    notes: notes ? { line1: notes.line1, line2: notes.line2, line3: notes.line3 } : null,
    report: phase === 'END' ? report : null,
  });

  response.headers.set('ETag', etag);
  response.headers.set('Cache-Control', 'no-cache');

  return response;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
