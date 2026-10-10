/**
 * Event resolution logic (runs in transaction).
 * Takes a snapshot of all teams' states, applies the event using pure engine functions,
 * and saves EventResult rows.
 */
import { Prisma } from '@prisma/client';
import { getTeamStates } from '@/lib/state';
import { DEFAULT_CONFIG, applyGoodEvent, applyBadEvent, computeGoodOptionDeltas, computeBadOptionDeltas, type GoodOption, type BadOption } from '@/lib/engine';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function resolveEvent(eventCode: string, tx: Tx) {
  const eventDef = await tx.eventDef.findUnique({
    where: { code: eventCode },
    include: {
      eventCompanies: { include: { company: true } },
    },
  });

  if (!eventDef) throw new Error(`Event ${eventCode} not found`);
  if (eventDef.resolved) return; // Idempotent

  // Lock game table conceptually handled by caller's transaction
  const teamStates = await getTeamStates(tx);

  const eventResultsData: any[] = [];
  
  await Promise.all(teamStates.map(async (team) => {
    // Determine choice. If no submission, default to PASS (good) or HOLD (bad).
    const choice = await tx.choice.findUnique({
      where: { teamId_eventId: { teamId: team.teamId, eventId: eventDef.id } },
    });

    let chosenOption = choice?.option;
    if (!chosenOption) {
      if (eventDef.kind === 'GOOD') {
        chosenOption = 'PASS';
      } else {
        const badParams = eventDef.eventCompanies.map(ec => ({
          companyId: ec.companyId,
          symbol: ec.company.symbol,
          holdDrop: ec.holdDrop,
        }));
        const deltas = computeBadOptionDeltas(team.cash, team.holdings, badParams, DEFAULT_CONFIG.exitFactor);
        
        let worstOption = deltas[0].option;
        let worstDelta = deltas[0].netWorthDelta;
        for (const d of deltas) {
          if (d.netWorthDelta.lt(worstDelta)) {
            worstDelta = d.netWorthDelta;
            worstOption = d.option;
          }
        }
        chosenOption = worstOption;
      }
    }

    if (eventDef.kind === 'GOOD') {
      const goodParams = eventDef.eventCompanies.map(ec => ({
        companyId: ec.companyId,
        symbol: ec.company.symbol,
        aggressiveMove: ec.aggressiveMove,
        moderateMove: ec.moderateMove,
      }));

      const outcome = applyGoodEvent(
        team.cash,
        team.holdings,
        goodParams,
        chosenOption as GoodOption,
        DEFAULT_CONFIG.feeRate
      );

      const deltas = computeGoodOptionDeltas(team.cash, team.holdings, goodParams, DEFAULT_CONFIG.feeRate);
      const deltasJson = deltas.reduce((acc, d) => ({ ...acc, [d.option]: d.netWorthDelta.toString() }), {});

      const companyDetails = outcome.companyResults.map(cr => ({
        companyId: cr.companyId,
        symbol: cr.symbol,
        sharesBefore: cr.sharesBefore,
        sharesAfter: cr.sharesAfter,
        priceBefore: cr.priceBefore.toString(),
        priceAfter: cr.priceAfter.toString(),
      }));

      eventResultsData.push({
        teamId: team.teamId,
        eventId: eventDef.id,
        chosenOption: chosenOption as any,
        effectiveOption: outcome.effectiveOption as any,
        downgradedFrom: outcome.downgradedFrom as any || null,
        feePaid: outcome.totalFee,
        cashBefore: team.cash,
        cashAfter: outcome.cashAfter,
        netWorthBefore: team.netWorth,
        netWorthAfter: team.netWorth.plus(outcome.netDelta),
        netWorthDelta: outcome.netDelta,
        optionDeltas: deltasJson,
        companyDetails,
        parameters: { feeRate: DEFAULT_CONFIG.feeRate.toString() },
        frozen: true,
      });

    } else {
      // BAD event
      const badParams = eventDef.eventCompanies.map(ec => ({
        companyId: ec.companyId,
        symbol: ec.company.symbol,
        holdDrop: ec.holdDrop,
      }));

      const outcome = applyBadEvent(
        team.cash,
        team.holdings,
        badParams,
        chosenOption as BadOption,
        DEFAULT_CONFIG.exitFactor
      );

      const deltas = computeBadOptionDeltas(team.cash, team.holdings, badParams, DEFAULT_CONFIG.exitFactor);
      const deltasJson = deltas.reduce((acc, d) => ({ ...acc, [d.option]: d.netWorthDelta.toString() }), {});

      const companyDetails = outcome.companyResults.map(cr => ({
        companyId: cr.companyId,
        symbol: cr.symbol,
        sharesBefore: cr.sharesBefore,
        sharesAfter: cr.sharesAfter,
        priceBefore: cr.priceBefore.toString(),
        priceAfter: cr.priceAfter.toString(),
      }));

      eventResultsData.push({
        teamId: team.teamId,
        eventId: eventDef.id,
        chosenOption: chosenOption as any,
        effectiveOption: outcome.effectiveOption as any,
        downgradedFrom: null,
        feePaid: 0,
        cashBefore: team.cash,
        cashAfter: outcome.cashAfter,
        netWorthBefore: team.netWorth,
        netWorthAfter: team.netWorth.plus(outcome.netDelta),
        netWorthDelta: outcome.netDelta,
        optionDeltas: deltasJson,
        companyDetails,
        parameters: { exitFactor: DEFAULT_CONFIG.exitFactor.toString() },
        frozen: true,
      });
    }
  }));

  if (eventResultsData.length > 0) {
    await tx.eventResult.createMany({
      data: eventResultsData
    });
  }

  // Mark event as resolved
  await tx.eventDef.update({
    where: { id: eventDef.id },
    data: { resolved: true },
  });
}
