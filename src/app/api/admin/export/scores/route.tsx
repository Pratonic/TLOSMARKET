/**
 * PDF generation for admin exports.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import ReactPDF from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { getTeamStates } from '@/lib/state';
import { computeFinalRanks, computeAutoScore, computeDecisionQuality, computeDiversificationScore, computeDownsideControl, computeFinancialReturn, computeJudgeBonus, computeRanks, computeRiskManagement, computeEventDecisionScore } from '@/lib/engine';
import Decimal from 'decimal.js';



// Disable React warning in Next.js edge/node
const { renderToStream } = ReactPDF;

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 12, fontFamily: 'Helvetica' },
  title: { fontSize: 20, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginBottom: 10, marginTop: 15, fontWeight: 'bold' },
  table: { display: 'flex', flexDirection: 'column', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf' },
  row: { display: 'flex', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#bfbfbf' },
  header: { backgroundColor: '#f0f0f0', fontWeight: 'bold' },
  cell: { padding: 5, flex: 1, borderRightWidth: 1, borderRightColor: '#bfbfbf', textAlign: 'center' },
  cellWide: { padding: 5, flex: 2, borderRightWidth: 1, borderRightColor: '#bfbfbf' },
  text: { marginBottom: 5 },
});

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teamsData = await prisma.team.findMany({
    include: { eventResults: { include: { event: true } }, judgeScores: true, trades: true },
  });

  const liveStates = await prisma.$transaction(async (tx) => getTeamStates(tx as any));

  const netWorths = liveStates.map(ts => ({ teamId: ts.teamId, netWorth: ts.netWorth, cash: ts.cash }));
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

  const scoreboard: any[] = [];

  for (const team of teamsData) {
    const ts = liveStates.find(s => s.teamId === team.id)!;
    
    // DQ
    const dqEvents = team.eventResults.map(er => {
      const deltasRaw = er.optionDeltas as Record<string, string>;
      const optionDeltas = Object.entries(deltasRaw).map(([opt, val]) => ({
        option: opt as any,
        netWorthDelta: new Decimal(val),
        affordable: true,
      }));
      return computeEventDecisionScore(optionDeltas, er.effectiveOption as any);
    });
    const dqScore = computeDecisionQuality(dqEvents);

    // RM
    const portfolioHoldingsMap = new Map<string, number>();
    for (const trade of team.trades) {
      portfolioHoldingsMap.set(trade.companyId, (portfolioHoldingsMap.get(trade.companyId) || 0) + trade.qty);
    }
    let activeCompaniesCount = 0;
    for (const qty of portfolioHoldingsMap.values()) {
      if (qty > 0) activeCompaniesCount++;
    }
    const divScore = computeDiversificationScore(activeCompaniesCount);
    const downsideScore = computeDownsideControl(teamBadDeltas.get(team.id) || new Decimal(0), maxLoss);
    const rmScore = computeRiskManagement(divScore, downsideScore);

    const frScore = financialReturns.get(team.id) || new Decimal(0);
    const autoScore = computeAutoScore(frScore, dqScore, rmScore);
    const judgeBonus = computeJudgeBonus(team.judgeScores);
    const finalScore = autoScore.plus(judgeBonus);

    scoreboard.push({
      name: team.name,
      rank: ranks.get(team.id) || 0,
      netWorth: ts.netWorth,
      cash: ts.cash,
      fr: frScore.toNumber(),
      dq: dqScore.toNumber(),
      rm: rmScore.toNumber(),
      auto: autoScore.toNumber(),
      judge: judgeBonus,
      final: finalScore.toNumber(),
    });
  }

  // Sort by final rank
  const finalRanking = computeFinalRanks(scoreboard.map(s => ({
    teamId: s.name,
    finalScore: new Decimal(s.final),
    financialReturn: new Decimal(s.fr),
    cash: s.cash,
  })));

  scoreboard.sort((a, b) => {
    const rankA = finalRanking.find(r => r.teamId === a.name)!.rank;
    const rankB = finalRanking.find(r => r.teamId === b.name)!.rank;
    return rankA - rankB;
  });

  const ScoreDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>TLOS Market Simulation - Final Scores</Text>
        
        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <Text style={styles.cell}>Rank</Text>
            <Text style={styles.cellWide}>Team</Text>
            <Text style={styles.cell}>Auto</Text>
            <Text style={styles.cell}>Judge</Text>
            <Text style={styles.cell}>Total</Text>
            <Text style={styles.cell}>Net Worth</Text>
          </View>
          {scoreboard.map((s, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.cell}>{finalRanking.find(r => r.teamId === s.name)!.rank}</Text>
              <Text style={styles.cellWide}>{s.name}</Text>
              <Text style={styles.cell}>{s.auto.toFixed(1)}</Text>
              <Text style={styles.cell}>{s.judge}</Text>
              <Text style={styles.cell}>{s.final.toFixed(1)}</Text>
              <Text style={styles.cell}>₹{s.netWorth.toNumber().toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.subtitle}>Detailed Breakdown</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <Text style={styles.cellWide}>Team</Text>
            <Text style={styles.cell}>Fin. Return</Text>
            <Text style={styles.cell}>Dec. Quality</Text>
            <Text style={styles.cell}>Risk Mgmt</Text>
          </View>
          {scoreboard.map((s, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.cellWide}>{s.name}</Text>
              <Text style={styles.cell}>{s.fr.toFixed(1)}</Text>
              <Text style={styles.cell}>{s.dq.toFixed(1)}</Text>
              <Text style={styles.cell}>{s.rm.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );

  const stream = await renderToStream(<ScoreDocument />);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="scores.pdf"',
    },
  });
}
