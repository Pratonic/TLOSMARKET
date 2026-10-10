import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { getTeamStates } from './state';
import { computeGoodOptionDeltas, computeBadOptionDeltas, GoodEventCompanyParams, BadEventCompanyParams, AnyOption } from './engine';

const prisma = new PrismaClient();

export interface TeamScore {
  teamId: string;
  teamName: string;
  financialReturn: number;
  decisionQuality: number;
  riskManagement: number;
  judgeBonus: number;
  autoScore: number;
  finalScore: number;
  breakdown: any;
}

export async function computeLeaderboardScores(): Promise<TeamScore[]> {
  const teams = await prisma.team.findMany({ include: { choices: true, trades: true } });
  
  const N = teams.length;
  if (N === 0) return [];

  // For accurate scoring we need the full live state simulator from state.ts
  const liveStates = await prisma.$transaction(async (tx) => getTeamStates(tx as any));

  // Financial Return (50 points)
  const netWorths = liveStates.map(ts => ({ id: ts.teamId, netWorth: ts.netWorth.toNumber() }));
  netWorths.sort((a, b) => b.netWorth - a.netWorth);
  
  const rankMap = new Map<string, number>();
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && netWorths[j].netWorth === netWorths[i].netWorth) { j++; }
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) { rankMap.set(netWorths[k].id, avgRank); }
    i = j;
  }

  // Find max loss for Risk Management
  let maxLoss = 0;
  const teamLosses = new Map<string, number>();
  for (const ts of liveStates) {
    const loss = 0; // Requires adding this to state
    teamLosses.set(ts.teamId, loss);
    if (loss > maxLoss) maxLoss = loss;
  }

  const scores: TeamScore[] = [];

  for (const team of teams) {
    const ts = liveStates.find(s => s.teamId === team.id)!;
    const rank = rankMap.get(team.id) || N;
    
    // 1. Financial Return
    const financialReturn = N > 1 ? 50 * (N - rank) / (N - 1) : 50;

    // 2. Risk Management
    const initialCompaniesCount = new Set(team.trades.filter(t => t.qty > 0).map(t => t.companyId)).size;
    let divScore = 0;
    if (initialCompaniesCount === 3) divScore = 4;
    else if (initialCompaniesCount === 4) divScore = 6;
    else if (initialCompaniesCount === 5) divScore = 8;
    else if (initialCompaniesCount >= 6) divScore = 10;

    const loss = teamLosses.get(team.id) || 0;
    const downsideScore = maxLoss <= 0 ? 10 : Math.max(0, 10 * (1 - (loss / maxLoss)));
    const riskManagement = divScore + downsideScore;

    // 3. Decision Quality
    // For a perfect implementation we replay the state. For now, since state.ts is complex, 
    // we use a simplified DQ based on their choices or just award them the average 15/30 if they played.
    // Let's calculate it fully using the timeline in getTeamStates if we had it, but we can approximate:
    let decisionQuality = 0; 
    if (decisionQuality === 0 && team.choices.length > 0) {
      // Default to 2.5 per event if not natively computed
      decisionQuality = team.choices.length * 2.5;
    }

    const autoScore = financialReturn + decisionQuality + riskManagement;

    scores.push({
      teamId: team.id,
      teamName: team.name,
      financialReturn,
      decisionQuality,
      riskManagement,
      judgeBonus: 0,
      autoScore,
      finalScore: autoScore, // Judge bonus not implemented in this mock yet
      breakdown: { rank, netWorth: ts.netWorth.toNumber(), divScore, downsideScore }
    });
  }

  return scores.sort((a, b) => b.finalScore - a.finalScore);
}
