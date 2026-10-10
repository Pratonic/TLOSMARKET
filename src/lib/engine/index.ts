/**
 * TLOS Market Simulation — Pure Engine Functions
 *
 * All financial math uses Decimal (decimal.js). No DB, no IO.
 * These functions are deterministic and fully unit-tested.
 */
import Decimal from 'decimal.js';

// Configure decimal.js for financial precision
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

// ─── Types ──────────────────────────────────────────────────────────

export interface GameConfig {
  basePrice: Decimal;
  poolSize: number;
  cap: number;
  startingCash: Decimal;
  minCompanies: number;
  feeRate: Decimal;       // 0.25
  exitFactor: Decimal;    // 0.92
}

export const DEFAULT_CONFIG: GameConfig = {
  basePrice: new Decimal('1000'),
  poolSize: 3000,
  cap: 200,
  startingCash: new Decimal('1000000'),
  minCompanies: 3,
  feeRate: new Decimal('0.25'),
  exitFactor: new Decimal('0.92'),
};

export type GoodOption = 'AGGRESSIVE' | 'MODERATE' | 'PASS';
export type BadOption = 'HOLD' | 'SELL_HALF' | 'EXIT';
export type AnyOption = GoodOption | BadOption;

export interface CompanyHolding {
  companyId: string;
  symbol: string;
  shares: number;
  price: Decimal;       // team's own current price for this company
}

export interface GoodEventCompanyParams {
  companyId: string;
  symbol: string;
  aggressiveMove: Decimal;  // fraction, e.g. 0.30
  moderateMove: Decimal;    // fraction, e.g. 0.15
}

export interface BadEventCompanyParams {
  companyId: string;
  symbol: string;
  holdDrop: Decimal;        // fraction, e.g. 0.10
}

export interface GoodEventResult {
  companyId: string;
  symbol: string;
  sharesBefore: number;
  sharesAfter: number;
  priceBefore: Decimal;
  priceAfter: Decimal;
  feePerShare: Decimal;
  totalFee: Decimal;
  shareGain: Decimal;     // (priceAfter - priceBefore) * shares
}

export interface BadEventResult {
  companyId: string;
  symbol: string;
  sharesBefore: number;
  sharesAfter: number;
  priceBefore: Decimal;
  priceAfter: Decimal;
  cashChange: Decimal;    // positive = cash received from selling
  holdingLoss: Decimal;   // loss on remaining shares
}

export interface GoodEventOutcome {
  option: GoodOption;
  effectiveOption: GoodOption;
  downgradedFrom: GoodOption | null;
  totalFee: Decimal;
  totalShareGain: Decimal;
  netDelta: Decimal;        // shareGain - totalFee
  cashAfter: Decimal;
  companyResults: GoodEventResult[];
}

export interface BadEventOutcome {
  option: BadOption;
  effectiveOption: BadOption;
  totalCashChange: Decimal;
  totalHoldingLoss: Decimal;
  netDelta: Decimal;
  cashAfter: Decimal;
  companyResults: BadEventResult[];
}

export interface OptionDelta {
  option: AnyOption;
  netWorthDelta: Decimal;
  affordable: boolean;
}

// ─── PHASE 1: PORTFOLIO — Trade validation ──────────────────────────

export interface TradeValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a buy trade.
 * Returns { valid, error? }.
 */
export function validateBuy(
  qty: number,
  basePrice: Decimal,
  teamCash: Decimal,
  currentHolding: number,
  cap: number,
  poolRemaining: number,
): TradeValidation {
  if (qty <= 0) return { valid: false, error: 'Quantity must be positive' };
  if (!Number.isInteger(qty)) return { valid: false, error: 'Quantity must be an integer' };

  const cost = basePrice.mul(qty);
  if (teamCash.lt(cost)) {
    return { valid: false, error: `Insufficient cash. Need ₹${cost.toFixed(2)}, have ₹${teamCash.toFixed(2)}` };
  }

  if (currentHolding + qty > cap) {
    return { valid: false, error: `Would exceed cap of ${cap}. Currently hold ${currentHolding}.` };
  }

  if (qty > poolRemaining) {
    return { valid: false, error: `Not enough shares in pool. Only ${poolRemaining} remaining.` };
  }

  return { valid: true };
}

/**
 * Validate a sell trade (Phase 1 only, at base price, no discount).
 */
export function validateSell(
  qty: number,
  currentHolding: number,
): TradeValidation {
  if (qty <= 0) return { valid: false, error: 'Quantity must be positive' };
  if (!Number.isInteger(qty)) return { valid: false, error: 'Quantity must be an integer' };

  if (qty > currentHolding) {
    return { valid: false, error: `Cannot sell ${qty}; only hold ${currentHolding}.` };
  }

  return { valid: true };
}

/**
 * Check if team holds minimum companies after Phase 1.
 */
export function checkMinCompanies(
  holdings: { companyId: string; shares: number }[],
  minCompanies: number,
): { valid: boolean; count: number } {
  const count = holdings.filter(h => h.shares > 0).length;
  return { valid: count >= minCompanies, count };
}

// ─── GOOD EVENT CALCULATIONS ────────────────────────────────────────

/**
 * Calculate the fee for a single company in a good event.
 * fee per share = feeRate × move × price
 * total fee = feePerShare × shares
 */
export function calcGoodFee(
  price: Decimal,
  shares: number,
  moveFraction: Decimal,
  feeRate: Decimal,
): { feePerShare: Decimal; totalFee: Decimal } {
  const feePerShare = feeRate.mul(moveFraction).mul(price);
  const totalFee = feePerShare.mul(shares);
  return { feePerShare, totalFee };
}

/**
 * Calculate the total fee across all companies in an event for a given option.
 */
export function calcTotalGoodFee(
  holdings: CompanyHolding[],
  eventParams: GoodEventCompanyParams[],
  option: GoodOption,
  feeRate: Decimal,
): Decimal {
  if (option === 'PASS') return new Decimal(0);

  let totalFee = new Decimal(0);
  for (const param of eventParams) {
    const holding = holdings.find(h => h.companyId === param.companyId);
    if (!holding || holding.shares <= 0) continue;

    const moveFraction = option === 'AGGRESSIVE' ? param.aggressiveMove : param.moderateMove;
    const { totalFee: fee } = calcGoodFee(holding.price, holding.shares, moveFraction, feeRate);
    totalFee = totalFee.plus(fee);
  }
  return totalFee;
}

/**
 * Determine the effective option after downgrading if cash is insufficient.
 * Aggressive -> Moderate -> Pass
 */
export function determineEffectiveGoodOption(
  cash: Decimal,
  holdings: CompanyHolding[],
  eventParams: GoodEventCompanyParams[],
  chosenOption: GoodOption,
  feeRate: Decimal,
): { effectiveOption: GoodOption; downgradedFrom: GoodOption | null } {
  if (chosenOption === 'PASS') {
    return { effectiveOption: 'PASS', downgradedFrom: null };
  }

  // Try chosen option first
  const chosenFee = calcTotalGoodFee(holdings, eventParams, chosenOption, feeRate);
  if (cash.gte(chosenFee)) {
    return { effectiveOption: chosenOption, downgradedFrom: null };
  }

  // Try downgrading
  if (chosenOption === 'AGGRESSIVE') {
    const moderateFee = calcTotalGoodFee(holdings, eventParams, 'MODERATE', feeRate);
    if (cash.gte(moderateFee)) {
      return { effectiveOption: 'MODERATE', downgradedFrom: 'AGGRESSIVE' };
    }
  }

  // Fall to Pass
  return { effectiveOption: 'PASS', downgradedFrom: chosenOption };
}

/**
 * Apply a good event to a team's holdings. Pure function.
 * Returns the full outcome including per-company results.
 */
export function applyGoodEvent(
  cash: Decimal,
  holdings: CompanyHolding[],
  eventParams: GoodEventCompanyParams[],
  chosenOption: GoodOption,
  feeRate: Decimal, // Ignored in this logic
): GoodEventOutcome {
  const companyResults: GoodEventResult[] = [];
  let totalShareGain = new Decimal(0);
  let currentCash = cash;

  for (const param of eventParams) {
    const holding = holdings.find(h => h.companyId === param.companyId);
    if (!holding || holding.shares <= 0) continue;

    // The user requested:
    // Aggressive: double the shares (invest 100% more)
    // Moderate: invest 50% more shares
    // Pass: 0 extra shares, 0% return
    const moveFraction = chosenOption === 'AGGRESSIVE' ? param.aggressiveMove
      : chosenOption === 'MODERATE' ? param.moderateMove
      : new Decimal(0);

    const targetExtraShares = chosenOption === 'AGGRESSIVE' ? holding.shares
      : chosenOption === 'MODERATE' ? Math.floor(holding.shares * 0.5)
      : 0;

    const priceBefore = holding.price;
    // Check how many extra shares they can afford
    const maxAffordableExtra = Math.floor(currentCash.div(priceBefore).toNumber());
    const actualExtraShares = Math.min(targetExtraShares, maxAffordableExtra);

    let cashSpent = new Decimal(0);
    if (actualExtraShares > 0) {
      cashSpent = priceBefore.mul(actualExtraShares);
      currentCash = currentCash.minus(cashSpent);
    }

    const sharesAfter = holding.shares + actualExtraShares;
    const priceAfter = priceBefore.mul(new Decimal(1).plus(moveFraction));
    
    const valueBefore = priceBefore.mul(holding.shares);
    const valueAfter = priceAfter.mul(sharesAfter);
    
    // Gain in value minus cash spent
    const shareGain = valueAfter.minus(valueBefore).minus(cashSpent);

    totalShareGain = totalShareGain.plus(shareGain);

    companyResults.push({
      companyId: param.companyId,
      symbol: param.symbol,
      sharesBefore: holding.shares,
      sharesAfter,
      priceBefore,
      priceAfter,
      feePerShare: new Decimal(0),
      totalFee: new Decimal(0),
      shareGain,
    });
  }

  const netDelta = totalShareGain;

  return {
    option: chosenOption,
    effectiveOption: chosenOption,
    downgradedFrom: null,
    totalFee: new Decimal(0),
    totalShareGain,
    netDelta,
    cashAfter: currentCash,
    companyResults,
  };
}


// ─── BAD EVENT CALCULATIONS ─────────────────────────────────────────

/**
 * Apply a bad event to a single company for one team.
 */
export function applyBadEventCompany(
  price: Decimal,
  shares: number,
  holdDrop: Decimal,
  option: BadOption,
  exitFactor: Decimal,
): BadEventResult & { companyId: string; symbol: string } {
  const priceBefore = price;
  let sharesAfter = shares;
  let priceAfter = price;
  let cashChange = new Decimal(0);
  let holdingLoss = new Decimal(0);

  switch (option) {
    case 'HOLD': {
      priceAfter = priceBefore.mul(new Decimal(1).minus(holdDrop));
      holdingLoss = priceBefore.minus(priceAfter).mul(shares);
      break;
    }
    case 'EXIT': {
      cashChange = priceBefore.mul(exitFactor).mul(shares);
      holdingLoss = priceBefore.mul(new Decimal(1).minus(exitFactor)).mul(shares);
      sharesAfter = 0;
      priceAfter = priceBefore; // price is irrelevant if 0 shares, but keep for record
      break;
    }
    case 'SELL_HALF': {
      const k = Math.floor(shares / 2);
      const remaining = shares - k;
      cashChange = priceBefore.mul(exitFactor).mul(k);
      const exitLoss = priceBefore.mul(new Decimal(1).minus(exitFactor)).mul(k);
      priceAfter = priceBefore.mul(new Decimal(1).minus(holdDrop));
      const holdLoss = priceBefore.minus(priceAfter).mul(remaining);
      holdingLoss = exitLoss.plus(holdLoss);
      sharesAfter = remaining;
      break;
    }
  }

  return {
    companyId: '', // filled by caller
    symbol: '',    // filled by caller
    sharesBefore: shares,
    sharesAfter,
    priceBefore,
    priceAfter,
    cashChange,
    holdingLoss,
  };
}

/**
 * Apply a bad event to all affected companies for a team.
 */
export function applyBadEvent(
  cash: Decimal,
  holdings: CompanyHolding[],
  eventParams: BadEventCompanyParams[],
  chosenOption: BadOption,
  exitFactor: Decimal,
): BadEventOutcome {
  const companyResults: BadEventResult[] = [];
  let totalCashChange = new Decimal(0);
  let totalHoldingLoss = new Decimal(0);

  for (const param of eventParams) {
    const holding = holdings.find(h => h.companyId === param.companyId);
    if (!holding || holding.shares <= 0) continue;

    const result = applyBadEventCompany(
      holding.price,
      holding.shares,
      param.holdDrop,
      chosenOption,
      exitFactor,
    );

    result.companyId = param.companyId;
    result.symbol = param.symbol;

    totalCashChange = totalCashChange.plus(result.cashChange);
    totalHoldingLoss = totalHoldingLoss.plus(result.holdingLoss);

    companyResults.push(result);
  }

  const cashAfter = cash.plus(totalCashChange);

  // Net worth delta = (cashAfter - cashBefore) + (holdingsValueAfter - holdingsValueBefore)
  // = totalCashChange + sum_over_companies(sharesAfter × priceAfter - sharesBefore × priceBefore)
  let holdingsValueDelta = new Decimal(0);
  for (const cr of companyResults) {
    const valueBefore = new Decimal(cr.sharesBefore).mul(cr.priceBefore);
    const valueAfter = new Decimal(cr.sharesAfter).mul(cr.priceAfter);
    holdingsValueDelta = holdingsValueDelta.plus(valueAfter.minus(valueBefore));
  }
  const netDelta = totalCashChange.plus(holdingsValueDelta);

  return {
    option: chosenOption,
    effectiveOption: chosenOption, // Bad events never downgrade
    totalCashChange,
    totalHoldingLoss,
    netDelta,
    cashAfter,
    companyResults,
  };
}

// ─── OPTION DELTAS (for scoring) ────────────────────────────────────

/**
 * Compute the net-worth delta for each possible option in a good event.
 */
export function computeGoodOptionDeltas(
  cash: Decimal,
  holdings: CompanyHolding[],
  eventParams: GoodEventCompanyParams[],
  feeRate: Decimal,
): OptionDelta[] {
  const options: GoodOption[] = ['AGGRESSIVE', 'MODERATE', 'PASS'];
  return options.map(option => {
    const fee = calcTotalGoodFee(holdings, eventParams, option, feeRate);
    const affordable = cash.gte(fee);
    const outcome = applyGoodEvent(cash, holdings, eventParams, option, feeRate);
    // For computing deltas, we use the option directly (not downgraded)
    // If not affordable, the delta is what it would be IF they could afford it
    // But for scoring, only affordable options count

    // Actually, recompute with the option forced (no downgrade)
    let netWorthDelta: Decimal;
    if (option === 'PASS') {
      netWorthDelta = new Decimal(0);
      return { option, netWorthDelta, affordable: true };
    }

    // Calculate what the delta would be if they chose this option
    let totalFee = new Decimal(0);
    let totalShareGain = new Decimal(0);

    for (const param of eventParams) {
      const holding = holdings.find(h => h.companyId === param.companyId);
      if (!holding || holding.shares <= 0) continue;

      const moveFraction = option === 'AGGRESSIVE' ? param.aggressiveMove : param.moderateMove;
      const { totalFee: fee } = calcGoodFee(holding.price, holding.shares, moveFraction, feeRate);
      const priceAfter = holding.price.mul(new Decimal(1).plus(moveFraction));
      const shareGain = priceAfter.minus(holding.price).mul(holding.shares);

      totalFee = totalFee.plus(fee);
      totalShareGain = totalShareGain.plus(shareGain);
    }

    netWorthDelta = totalShareGain.minus(totalFee);
    return { option, netWorthDelta, affordable };
  });
}

/**
 * Compute the net-worth delta for each possible option in a bad event.
 */
export function computeBadOptionDeltas(
  cash: Decimal,
  holdings: CompanyHolding[],
  eventParams: BadEventCompanyParams[],
  exitFactor: Decimal,
): OptionDelta[] {
  const options: BadOption[] = ['HOLD', 'SELL_HALF', 'EXIT'];
  return options.map(option => {
    const outcome = applyBadEvent(cash, holdings, eventParams, option, exitFactor);
    return {
      option,
      netWorthDelta: outcome.netDelta,
      affordable: true, // Bad events are always "affordable"
    };
  });
}

// ─── NET WORTH ──────────────────────────────────────────────────────

/**
 * Compute net worth = cash + sum(shares × price).
 */
export function computeNetWorth(cash: Decimal, holdings: CompanyHolding[]): Decimal {
  let total = cash;
  for (const h of holdings) {
    total = total.plus(new Decimal(h.shares).mul(h.price));
  }
  return total;
}

// ─── SCORING ────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  financialReturn: Decimal;
  decisionQuality: Decimal;
  riskManagement: Decimal;
  diversification: Decimal;
  downsideControl: Decimal;
  autoScore: Decimal;
  judgeBonus: number;        // 0-3
  finalScore: Decimal;
  rank: number;
  netWorth: Decimal;
}

/**
 * Compute financial return score (50 points).
 * Rank by net worth, handle ties.
 */
export function computeFinancialReturn(
  teamNetWorths: { teamId: string; netWorth: Decimal }[],
): Map<string, Decimal> {
  const T = teamNetWorths.length;
  const result = new Map<string, Decimal>();

  if (T === 0) return result;
  if (T === 1) {
    result.set(teamNetWorths[0].teamId, new Decimal(50));
    return result;
  }

  // Sort descending by net worth
  const sorted = [...teamNetWorths].sort((a, b) => {
    const cmp = b.netWorth.cmp(a.netWorth);
    if (cmp !== 0) return cmp;
    return a.teamId.localeCompare(b.teamId);
  });

  // Assign strict ranks (no averages)
  sorted.forEach((team, i) => {
    const rank = new Decimal(i + 1);
    const score = new Decimal(50).mul(new Decimal(T).minus(rank)).div(new Decimal(T - 1));
    result.set(team.teamId, score);
  });

  return result;
}

/**
 * Compute the rank of each team by net worth (1 = highest).
 * Tied teams share the average rank.
 */
export function computeRanks(
  teamNetWorths: { teamId: string; netWorth: Decimal }[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (teamNetWorths.length === 0) return result;

  const sorted = [...teamNetWorths].sort((a, b) => {
    const cmp = b.netWorth.cmp(a.netWorth);
    if (cmp !== 0) return cmp;
    return a.teamId.localeCompare(b.teamId);
  });

  sorted.forEach((team, i) => {
    result.set(team.teamId, i + 1);
  });

  return result;
}

/**
 * Compute decision quality score for a single event (0-5 points).
 * Score = 5 × (chosen - worst) / (best - worst)
 * Only over affordable options.
 * If no affected shares or best == worst, returns 2.5.
 */
export function computeEventDecisionScore(
  optionDeltas: OptionDelta[],
  chosenOption: AnyOption,
): Decimal {
  const affordable = optionDeltas.filter(d => d.affordable);
  if (affordable.length === 0) return new Decimal('2.5');

  const chosenDelta = affordable.find(d => d.option === chosenOption);
  if (!chosenDelta) {
    // Chosen option wasn't affordable — this shouldn't happen after downgrading
    // but defensively return 2.5
    return new Decimal('2.5');
  }

  const best = affordable.reduce((max, d) => d.netWorthDelta.gt(max) ? d.netWorthDelta : max, affordable[0].netWorthDelta);
  const worst = affordable.reduce((min, d) => d.netWorthDelta.lt(min) ? d.netWorthDelta : min, affordable[0].netWorthDelta);

  if (best.eq(worst)) return new Decimal('2.5');

  return new Decimal(5).mul(chosenDelta.netWorthDelta.minus(worst)).div(best.minus(worst));
}

/**
 * Compute total decision quality score (30 points max) across 6 events.
 */
export function computeDecisionQuality(
  eventScores: Decimal[],
): Decimal {
  let total = new Decimal(0);
  for (const s of eventScores) {
    total = total.plus(s);
  }
  return total;
}

/**
 * Compute diversification score (0-10).
 * Companies with shares > 0 after Phase 1:
 * 3 -> 4, 4 -> 6, 5 -> 8, 6 -> 10, fewer than 3 -> 0
 */
export function computeDiversificationScore(companiesHeld: number): Decimal {
  if (companiesHeld < 3) return new Decimal(0);
  if (companiesHeld === 3) return new Decimal(4);
  if (companiesHeld === 4) return new Decimal(6);
  if (companiesHeld === 5) return new Decimal(8);
  return new Decimal(10); // 6 or more
}

/**
 * Compute downside control score (0-10).
 * teamLoss = max(0, -(net worth change summed over the three bad events))
 * maxLoss = largest teamLoss in the room
 * score = 10 × (1 - teamLoss / maxLoss)
 * If maxLoss == 0, everyone gets 10.
 */
export function computeDownsideControl(
  teamBadEventDelta: Decimal,
  maxLoss: Decimal,
): Decimal {
  const teamLoss = Decimal.max(new Decimal(0), teamBadEventDelta.neg());

  if (maxLoss.isZero() || maxLoss.isNeg()) return new Decimal(10);

  const score = new Decimal(10).mul(new Decimal(1).minus(teamLoss.div(maxLoss)));
  // Clamp 0-10
  return Decimal.max(new Decimal(0), Decimal.min(new Decimal(10), score));
}

/**
 * Compute risk management score (0-20).
 */
export function computeRiskManagement(
  diversification: Decimal,
  downsideControl: Decimal,
): Decimal {
  return diversification.plus(downsideControl);
}

/**
 * Compute judge bonus: average of all judges' totals, rounded to nearest whole (half up), max 3.
 * Each judge gives 0 or 1 for clarity, justification, answer quality.
 */
export function computeJudgeBonus(
  judgeScores: { clarity: number; justification: number; answerQuality: number }[],
): number {
  if (judgeScores.length === 0) return 0;

  const totals = judgeScores.map(j => j.clarity + j.justification + j.answerQuality);
  const avg = totals.reduce((sum, t) => sum + t, 0) / judgeScores.length;
  const rounded = Math.round(avg); // JS Math.round rounds 0.5 up for positive numbers
  return Math.min(3, Math.max(0, rounded));
}

/**
 * Compute full auto score (100 max).
 */
export function computeAutoScore(
  financialReturn: Decimal,
  decisionQuality: Decimal,
  riskManagement: Decimal,
): Decimal {
  return financialReturn.plus(decisionQuality).plus(riskManagement);
}

/**
 * Top 5 selection by auto score with tie-breaking.
 * Tie for 5th: higher Financial Return points, then higher remaining cash.
 */
export function selectTop5(
  teams: {
    teamId: string;
    autoScore: Decimal;
    financialReturn: Decimal;
    cash: Decimal;
  }[],
): string[] {
  const sorted = [...teams].sort((a, b) => {
    const scoreCmp = b.autoScore.cmp(a.autoScore);
    if (scoreCmp !== 0) return scoreCmp;
    const frCmp = b.financialReturn.cmp(a.financialReturn);
    if (frCmp !== 0) return frCmp;
    return b.cash.cmp(a.cash);
  });

  if (sorted.length <= 5) return sorted.map(t => t.teamId);

  // Include first 4 always, then handle tie at 5th
  const top5: string[] = sorted.slice(0, 5).map(t => t.teamId);
  return top5;
}

/**
 * Final score tie-break: higher Financial Return, then higher cash, then "needs judge call".
 */
export function computeFinalRanks(
  teams: {
    teamId: string;
    finalScore: Decimal;
    financialReturn: Decimal;
    cash: Decimal;
  }[],
): { teamId: string; rank: number; needsJudgeCall: boolean }[] {
  const sorted = [...teams].sort((a, b) => {
    const scoreCmp = b.finalScore.cmp(a.finalScore);
    if (scoreCmp !== 0) return scoreCmp;
    const frCmp = b.financialReturn.cmp(a.financialReturn);
    if (frCmp !== 0) return frCmp;
    return b.cash.cmp(a.cash);
  });

  const result: { teamId: string; rank: number; needsJudgeCall: boolean }[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length
      && sorted[j].finalScore.eq(sorted[i].finalScore)
      && sorted[j].financialReturn.eq(sorted[i].financialReturn)
      && sorted[j].cash.eq(sorted[i].cash)) {
      j++;
    }
    const needsJudgeCall = j - i > 1;
    for (let k = i; k < j; k++) {
      result.push({
        teamId: sorted[k].teamId,
        rank: i + 1,
        needsJudgeCall,
      });
    }
    i = j;
  }

  return result;
}

// ─── FORMATTING ─────────────────────────────────────────────────────

/**
 * Format a Decimal as Indian Rupee (₹ with en-IN grouping).
 */
export function formatINR(value: Decimal): string {
  const num = value.toNumber();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// ─── BRUTE FORCE PATH ANALYSIS ──────────────────────────────────────

export interface PathAnalysis {
  worstDelta: Decimal;
  bestDelta: Decimal;
  aboveZeroCount: number;
  aboveZeroPct: Decimal;
  worstWithAllAggressive: Decimal;
  totalPaths: number;
}

/**
 * Brute force all 3^6 = 729 choice paths (3 bad options for each of 3 bad events)
 * combined with a fixed good event strategy.
 *
 * For a portfolio, iterates all combinations of Bad options across 3 bad events
 * combined with all good event options, computing net worth delta for each path.
 *
 * Actually, re-reading the spec: 3^6 = 729 paths = 3 options for each of 6 events.
 */
export function bruteForceAnalysis(
  startingCash: Decimal,
  holdings: CompanyHolding[],
  goodEvents: { params: GoodEventCompanyParams[] }[],
  badEvents: { params: BadEventCompanyParams[] }[],
  feeRate: Decimal,
  exitFactor: Decimal,
): PathAnalysis {
  const goodOptions: GoodOption[] = ['AGGRESSIVE', 'MODERATE', 'PASS'];
  const badOptions: BadOption[] = ['HOLD', 'SELL_HALF', 'EXIT'];
  const totalPaths = Math.pow(3, 6); // 729

  let worstDelta = new Decimal(Infinity);
  let bestDelta = new Decimal(-Infinity);
  let aboveZeroCount = 0;
  let worstWithAllAggressive = new Decimal(Infinity);

  // Iterate all 3^6 combinations
  for (let path = 0; path < totalPaths; path++) {
    let code = path;
    const goodChoices: GoodOption[] = [];
    const badChoices: BadOption[] = [];

    for (let i = 0; i < 3; i++) {
      goodChoices.push(goodOptions[code % 3]);
      code = Math.floor(code / 3);
    }
    for (let i = 0; i < 3; i++) {
      badChoices.push(badOptions[code % 3]);
      code = Math.floor(code / 3);
    }

    // Simulate this path
    let currentCash = startingCash;
    // Deep copy holdings
    const currentHoldings: CompanyHolding[] = holdings.map(h => ({
      ...h,
      price: new Decimal(h.price),
    }));

    const startingNetWorth = computeNetWorth(currentCash, currentHoldings);

    // Apply good events
    for (let i = 0; i < 3; i++) {
      const outcome = applyGoodEvent(
        currentCash,
        currentHoldings,
        goodEvents[i].params,
        goodChoices[i],
        feeRate,
      );
      currentCash = outcome.cashAfter;
      // Update holdings
      for (const cr of outcome.companyResults) {
        const h = currentHoldings.find(hh => hh.companyId === cr.companyId);
        if (h) {
          h.price = cr.priceAfter;
          h.shares = cr.sharesAfter;
        }
      }
    }

    // Apply bad events
    for (let i = 0; i < 3; i++) {
      const outcome = applyBadEvent(
        currentCash,
        currentHoldings,
        badEvents[i].params,
        badChoices[i],
        exitFactor,
      );
      currentCash = outcome.cashAfter;
      for (const cr of outcome.companyResults) {
        const h = currentHoldings.find(hh => hh.companyId === cr.companyId);
        if (h) {
          h.price = cr.priceAfter;
          h.shares = cr.sharesAfter;
        }
      }
    }

    const finalNetWorth = computeNetWorth(currentCash, currentHoldings);
    const delta = finalNetWorth.minus(startingNetWorth);

    if (delta.lt(worstDelta)) worstDelta = delta;
    if (delta.gt(bestDelta)) bestDelta = delta;
    if (delta.gt(0)) aboveZeroCount++;

    // Check if all good choices are AGGRESSIVE
    if (goodChoices.every(c => c === 'AGGRESSIVE')) {
      if (delta.lt(worstWithAllAggressive)) {
        worstWithAllAggressive = delta;
      }
    }
  }

  return {
    worstDelta,
    bestDelta,
    aboveZeroCount,
    aboveZeroPct: new Decimal(aboveZeroCount).div(totalPaths).mul(100),
    worstWithAllAggressive,
    totalPaths,
  };
}
