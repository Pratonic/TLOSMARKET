/**
 * PDF generation for per-team reports (Top 5 only).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import ReactPDF from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { getTeamStates } from '@/lib/state';
import { computeFinalRanks, computeAutoScore, computeDecisionQuality, computeDiversificationScore, computeDownsideControl, computeFinancialReturn, computeJudgeBonus, computeRanks, computeRiskManagement, computeEventDecisionScore, selectTop5 } from '@/lib/engine';
import Decimal from 'decimal.js';



const { renderToStream } = ReactPDF;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica' },
  header: { fontSize: 24, marginBottom: 10, textAlign: 'center', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, marginTop: 20, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 5 },
  row: { display: 'flex', flexDirection: 'row', marginBottom: 5 },
  label: { width: 150, fontWeight: 'bold' },
  value: { flex: 1 },
  table: { display: 'flex', flexDirection: 'column', width: '100%', marginTop: 10, borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf' },
  tableRow: { display: 'flex', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#bfbfbf' },
  tableHeader: { backgroundColor: '#f0f0f0', fontWeight: 'bold' },
  cell: { padding: 5, flex: 1, borderRightWidth: 1, borderRightColor: '#bfbfbf', textAlign: 'center' },
  cellWide: { padding: 5, flex: 2, borderRightWidth: 1, borderRightColor: '#bfbfbf' },
  notesBox: { marginTop: 10, padding: 10, backgroundColor: '#f9f9f9', borderStyle: 'solid', borderWidth: 1, borderColor: '#e0e0e0' },
  noteLine: { marginBottom: 5, fontStyle: 'italic' },
  text: { marginBottom: 5 },
});

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teamsData = await prisma.team.findMany({
    include: { eventResults: { include: { event: true } }, judgeScores: true, trades: true, teamNotes: true },
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

  const scoreboard = [];

  for (const team of teamsData) {
    const ts = liveStates.find(s => s.teamId === team.id)!;
    
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
      teamId: team.id,
      name: team.name,
      rank: ranks.get(team.id) || 0,
      netWorth: ts.netWorth,
      cash: ts.cash,
      fr: frScore,
      autoScore: autoScore,
      final: finalScore,
      dq: dqScore,
      rm: rmScore,
      judge: judgeBonus,
      eventResults: team.eventResults,
      notes: team.teamNotes,
    });
  }

  // Select top 5
  const top5Ids = selectTop5(scoreboard.map(s => ({ ...s, financialReturn: s.fr })));
  const top5Teams = scoreboard.filter(s => top5Ids.includes(s.teamId)).sort((a, b) => b.final.cmp(a.final));

  const ReportsDocument = () => (
    <Document>
      {top5Teams.map(team => (
        <Page size="A4" style={styles.page} key={team.teamId}>
          <Text style={styles.header}>{team.name} - Final Report</Text>
          
          <Text style={styles.sectionTitle}>Performance Summary</Text>
          <View style={styles.row}><Text style={styles.label}>Final Rank:</Text><Text style={styles.value}>{team.rank}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Final Score:</Text><Text style={styles.value}>{team.final.toFixed(1)} / 103</Text></View>
          <View style={styles.row}><Text style={styles.label}>Auto Score:</Text><Text style={styles.value}>{team.autoScore.toFixed(1)} / 100</Text></View>
          <View style={styles.row}><Text style={styles.label}>Judge Bonus:</Text><Text style={styles.value}>+{team.judge}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Net Worth:</Text><Text style={styles.value}>₹{team.netWorth.toNumber().toLocaleString('en-IN')}</Text></View>
          
          <Text style={styles.sectionTitle}>Metric Breakdown</Text>
          <View style={styles.row}><Text style={styles.label}>Financial Return:</Text><Text style={styles.value}>{team.fr.toFixed(1)} / 50</Text></View>
          <View style={styles.row}><Text style={styles.label}>Decision Quality:</Text><Text style={styles.value}>{team.dq.toFixed(1)} / 30</Text></View>
          <View style={styles.row}><Text style={styles.label}>Risk Management:</Text><Text style={styles.value}>{team.rm.toFixed(1)} / 20</Text></View>

          <Text style={styles.sectionTitle}>Event Log</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.cellWide}>Event</Text>
              <Text style={styles.cell}>Choice</Text>
              <Text style={styles.cell}>Effective</Text>
              <Text style={styles.cell}>NW Delta</Text>
            </View>
            {team.eventResults.sort((a, b) => a.event.orderIndex - b.event.orderIndex).map(er => (
              <View style={styles.tableRow} key={er.id}>
                <Text style={styles.cellWide}>{er.event.code}</Text>
                <Text style={styles.cell}>{er.chosenOption}</Text>
                <Text style={styles.cell}>{er.effectiveOption}</Text>
                <Text style={styles.cell}>{new Decimal(er.netWorthDelta.toString()).gt(0) ? '+' : ''}{new Decimal(er.netWorthDelta.toString()).toNumber().toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Team Notes</Text>
          <View style={styles.notesBox}>
            <Text style={styles.noteLine}>1. Why we built this portfolio:</Text>
            <Text style={styles.text}>{team.notes?.line1 || 'No response provided.'}</Text>
            
            <Text style={[styles.noteLine, { marginTop: 10 }]}>2. Our most important decision:</Text>
            <Text style={styles.text}>{team.notes?.line2 || 'No response provided.'}</Text>
            
            <Text style={[styles.noteLine, { marginTop: 10 }]}>3. What we would change:</Text>
            <Text style={styles.text}>{team.notes?.line3 || 'No response provided.'}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );

  const stream = await renderToStream(<ReportsDocument />);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="top5-reports.pdf"',
    },
  });
}
