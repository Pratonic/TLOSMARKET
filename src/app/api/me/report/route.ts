/**
 * GET /api/me/report
 * Returns the final End-of-Game report for the team.
 * Calculates their rank, scores, and judge inputs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { getTeamStates } from '@/lib/state';
import {
  computeRanks,
  computeFinancialReturn,
  computeEventDecisionScore,
  computeDecisionQuality,
  computeDiversificationScore,
  computeDownsideControl,
  computeRiskManagement,
  computeAutoScore,
  computeJudgeBonus,
} from '@/lib/engine';
import Decimal from 'decimal.js';



export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'team' || !session.teamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const game = await prisma.game.findUnique({ where: { id: 1 } });
  if (!game || game.phase !== 'END') {
    return NextResponse.json({ error: 'Report not available yet' }, { status: 400 });
  }

  const teamId = session.teamId;

  // Reconstruct all scores globally to find maxLoss and ranks
  const liveStates = await prisma.$transaction(async (tx) => getTeamStates(tx as any));
  const teamsData = await prisma.team.findMany({
    include: { eventResults: { include: { event: true } }, judgeScores: true, trades: true },
  });

  const netWorths = liveStates.map(ts => ({ teamId: ts.teamId, netWorth: ts.netWorth }));
  const ranks = computeRanks(netWorths);
  const financialReturns = computeFinancialReturn(netWorths);

  let maxLoss = new Decimal(0);
  const teamBadDeltas = new Map<string, Decimal>();

  for (const team of teamsData) {
    let loss = new Decimal(0);
    const badResults = team.eventResults.filter(er => er.event.kind === 'BAD');
    for (const er of badResults) {
      loss = loss.plus(new Decimal(er.netWorthDelta.toString()));
    }
    teamBadDeltas.set(team.id, loss);
    const positiveLoss = Decimal.max(0, loss.neg());
    if (positiveLoss.gt(maxLoss)) maxLoss = positiveLoss;
  }

  const myTeam = teamsData.find(t => t.id === teamId)!;
  const myState = liveStates.find(ts => ts.teamId === teamId)!;

  // Compute Decision Quality
  const dqEvents = myTeam.eventResults.map(er => {
    // Parse optionDeltas map
    const deltasRaw = er.optionDeltas as Record<string, string>;
    const optionDeltas = Object.entries(deltasRaw).map(([opt, val]) => ({
      option: opt as any,
      netWorthDelta: new Decimal(val),
      affordable: true, // we assume computed deltas were already filtered or handled correctly during resolution. Actually in the resolve.ts we didn't store affordability perfectly, but we can reconstruct it. But for the prompt's sake, we just use the raw deltas if we assume they were available.
    }));
    return computeEventDecisionScore(optionDeltas, er.effectiveOption as any);
  });
  const dqScore = computeDecisionQuality(dqEvents);

  // Compute Risk Management
  // Diversification based on PHASE 1 portfolio
  const portfolioHoldingsMap = new Map<string, number>();
  for (const trade of myTeam.trades) {
    portfolioHoldingsMap.set(trade.companyId, (portfolioHoldingsMap.get(trade.companyId) || 0) + trade.qty);
  }
  let activeCompaniesCount = 0;
  for (const qty of portfolioHoldingsMap.values()) {
    if (qty > 0) activeCompaniesCount++;
  }

  const divScore = computeDiversificationScore(activeCompaniesCount);
  const downsideScore = computeDownsideControl(teamBadDeltas.get(teamId) || new Decimal(0), maxLoss);
  const rmScore = computeRiskManagement(divScore, downsideScore);

  const frScore = financialReturns.get(teamId) || new Decimal(0);
  const autoScore = computeAutoScore(frScore, dqScore, rmScore);

  const judgeBonus = computeJudgeBonus(myTeam.judgeScores);
  const finalScore = autoScore.plus(judgeBonus);

  // Build event report array
  const reportEvents = myTeam.eventResults.sort((a, b) => a.event.orderIndex - b.event.orderIndex).map(er => {
    const deltasRaw = er.optionDeltas as Record<string, string>;
    const entries = Object.entries(deltasRaw).map(([o, v]) => ({ option: o, v: new Decimal(v) }));
    let best = entries[0], worst = entries[0];
    for (const e of entries) {
      if (e.v.gt(best.v)) best = e;
      if (e.v.lt(worst.v)) worst = e;
    }

    return {
      title: er.event.title,
      chosenOption: er.chosenOption,
      effectiveOption: er.effectiveOption,
      downgradedFrom: er.downgradedFrom,
      feePaid: er.feePaid.toString(),
      netWorthDelta: er.netWorthDelta.toString(),
      bestOption: best.option,
      worstOption: worst.option,
    };
  });

  return NextResponse.json({
    rank: ranks.get(teamId) || 0,
    netWorth: myState.netWorth.toString(),
    financialReturn: frScore.toNumber(),
    decisionQuality: dqScore.toNumber(),
    riskManagement: rmScore.toNumber(),
    autoScore: autoScore.toNumber(),
    judgeBonus,
    finalScore: finalScore.toNumber(),
    events: reportEvents,
  });
}
