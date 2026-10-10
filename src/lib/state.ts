/**
 * State fold logic.
 * Team state = fold(initial cash, Trades, EventResults).
 */
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface ComputedTeamState {
  teamId: string;
  name: string;
  username: string;
  cash: Decimal;
  netWorth: Decimal;
  holdings: {
    companyId: string;
    symbol: string;
    shares: number;
    price: Decimal;
  }[];
}

export async function getTeamStates(tx: Tx): Promise<ComputedTeamState[]> {
  const teams = await tx.team.findMany({
    include: {
      trades: true,
      eventResults: {
        include: { event: true },
      },
    },
  });

  const companies = await tx.company.findMany();
  const basePrices = new Map<string, Decimal>(companies.map((c: { id: string; basePrice: any }) => [c.id, new Decimal(c.basePrice.toString())]));
  const companySymbols = new Map<string, string>(companies.map((c: { id: string; symbol: string }) => [c.id, c.symbol]));

  const computedStates: ComputedTeamState[] = [];

  for (const team of teams) {
    let cash = new Decimal(team.startingCash.toString());
    const holdings = new Map<string, { shares: number; price: Decimal }>();

    // Initialize holdings with 0 shares and base price
    for (const c of companies) {
      holdings.set(c.id, { shares: 0, price: basePrices.get(c.id)! });
    }

    // Apply trades
    for (const trade of team.trades) {
      const current = holdings.get(trade.companyId)!;
      current.shares += trade.qty;
      if (trade.qty > 0) {
        cash = cash.minus(new Decimal(trade.price.toString()).mul(trade.qty));
      } else {
        cash = cash.plus(new Decimal(trade.price.toString()).mul(Math.abs(trade.qty)));
      }
    }

    // Sort event results by event orderIndex
    const sortedResults = [...team.eventResults].sort((a: any, b: any) => a.event.orderIndex - b.event.orderIndex);

    // Apply event results
    for (const result of sortedResults) {
      cash = new Decimal(result.cashAfter.toString());
      const details = result.companyDetails as any[];
      for (const d of details) {
        const current = holdings.get(d.companyId);
        if (current) {
          current.shares = d.sharesAfter;
          current.price = new Decimal(d.priceAfter.toString());
        }
      }
    }

    let netWorth = cash;
    const finalHoldings: { companyId: string; symbol: string; shares: number; price: Decimal }[] = [];
    for (const [companyId, h] of holdings.entries()) {
      if (h.shares > 0) {
        netWorth = netWorth.plus(h.price.mul(h.shares));
      }
      finalHoldings.push({
        companyId,
        symbol: companySymbols.get(companyId)!,
        shares: h.shares,
        price: h.price,
      });
    }

    computedStates.push({
      teamId: team.id,
      name: team.name,
      username: team.username,
      cash,
      netWorth,
      holdings: finalHoldings,
    });
  }

  return computedStates;
}
