/**
 * TLOS Market Simulation — Engine Unit Tests
 *
 * Tests all pure functions from the engine with exact values from the PDF.
 * Uses Vitest + decimal.js.
 */
import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  validateBuy,
  validateSell,
  checkMinCompanies,
  calcGoodFee,
  calcTotalGoodFee,
  determineEffectiveGoodOption,
  applyGoodEvent,
  applyBadEvent,
  applyBadEventCompany,
  computeGoodOptionDeltas,
  computeBadOptionDeltas,
  computeNetWorth,
  computeFinancialReturn,
  computeRanks,
  computeEventDecisionScore,
  computeDecisionQuality,
  computeDiversificationScore,
  computeDownsideControl,
  computeRiskManagement,
  computeJudgeBonus,
  computeAutoScore,
  selectTop5,
  computeFinalRanks,
  formatINR,
  bruteForceAnalysis,
  DEFAULT_CONFIG,
  type CompanyHolding,
  type GoodEventCompanyParams,
  type BadEventCompanyParams,
  type OptionDelta,
} from './index';

// ─── Helper ─────────────────────────────────────────────────────────

function d(val: string | number): Decimal {
  return new Decimal(val);
}

function expectDecimalClose(actual: Decimal, expected: string | number, tolerance = '0.01') {
  const diff = actual.minus(new Decimal(expected)).abs();
  expect(diff.lte(new Decimal(tolerance))).toBe(true);
}

// ─── Standard test data ─────────────────────────────────────────────

const NOVA_ID = 'nova';
const VOLT_ID = 'volt';
const SHIPX_ID = 'shipx';
const FINCO_ID = 'finco';
const FRESH_ID = 'fresh';
const MEDIX_ID = 'medix';

// Event company params from the spec
const G1_PARAMS: GoodEventCompanyParams[] = [
  { companyId: NOVA_ID, symbol: 'NOVA', aggressiveMove: d('0.30'), moderateMove: d('0.15') },
];

const G2_PARAMS: GoodEventCompanyParams[] = [
  { companyId: VOLT_ID, symbol: 'VOLT', aggressiveMove: d('0.22'), moderateMove: d('0.11') },
  { companyId: SHIPX_ID, symbol: 'SHIPX', aggressiveMove: d('0.14'), moderateMove: d('0.07') },
];

const G3_PARAMS: GoodEventCompanyParams[] = [
  { companyId: FINCO_ID, symbol: 'FINCO', aggressiveMove: d('0.18'), moderateMove: d('0.09') },
  { companyId: FRESH_ID, symbol: 'FRESH', aggressiveMove: d('0.10'), moderateMove: d('0.05') },
];

const B1_PARAMS: BadEventCompanyParams[] = [
  { companyId: NOVA_ID, symbol: 'NOVA', holdDrop: d('0.10') },
  { companyId: FINCO_ID, symbol: 'FINCO', holdDrop: d('0.04') },
];

const B2_PARAMS: BadEventCompanyParams[] = [
  { companyId: VOLT_ID, symbol: 'VOLT', holdDrop: d('0.09') },
  { companyId: SHIPX_ID, symbol: 'SHIPX', holdDrop: d('0.06') },
];

const B3_PARAMS: BadEventCompanyParams[] = [
  { companyId: FRESH_ID, symbol: 'FRESH', holdDrop: d('0.04') },
  { companyId: MEDIX_ID, symbol: 'MEDIX', holdDrop: d('0.06') },
];

const ALL_GOOD_EVENTS = [
  { params: G1_PARAMS },
  { params: G2_PARAMS },
  { params: G3_PARAMS },
];

const ALL_BAD_EVENTS = [
  { params: B1_PARAMS },
  { params: B2_PARAMS },
  { params: B3_PARAMS },
];

const FEE_RATE = d('0.25');
const EXIT_FACTOR = d('0.92');
const BASE_PRICE = d('1000');

// ─── PHASE 1: Trade validation tests ────────────────────────────────

describe('Trade Validation', () => {
  it('validates a valid buy', () => {
    const result = validateBuy(100, d('1000'), d('1000000'), 0, 200, 2000);
    expect(result.valid).toBe(true);
  });

  it('rejects buy when insufficient cash', () => {
    const result = validateBuy(100, d('1000'), d('50000'), 0, 200, 2000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Insufficient cash');
  });

  it('rejects buy exceeding cap', () => {
    const result = validateBuy(50, d('1000'), d('1000000'), 160, 200, 2000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cap');
  });

  it('rejects buy when pool empty', () => {
    const result = validateBuy(50, d('1000'), d('1000000'), 0, 200, 30);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pool');
  });

  it('rejects non-integer quantities', () => {
    expect(validateBuy(1.5, d('1000'), d('1000000'), 0, 200, 2000).valid).toBe(false);
    expect(validateSell(1.5, 100).valid).toBe(false);
  });

  it('validates sell correctly', () => {
    expect(validateSell(50, 100).valid).toBe(true);
    expect(validateSell(150, 100).valid).toBe(false);
  });
});

// ─── Min companies check ─────────────────────────────────────────

describe('Min Companies Check', () => {
  it('passes with 3 companies', () => {
    const holdings = [
      { companyId: 'a', shares: 100 },
      { companyId: 'b', shares: 50 },
      { companyId: 'c', shares: 1 },
    ];
    expect(checkMinCompanies(holdings, 3)).toEqual({ valid: true, count: 3 });
  });

  it('fails with 2 companies', () => {
    const holdings = [
      { companyId: 'a', shares: 100 },
      { companyId: 'b', shares: 50 },
      { companyId: 'c', shares: 0 },
    ];
    expect(checkMinCompanies(holdings, 3)).toEqual({ valid: false, count: 2 });
  });
});

// ─── GOOD EVENT: PDF examples ───────────────────────────────────────

describe('Good Event - PDF Examples', () => {
  it('NOVA 200 shares, G1 Aggressive: fee 15,000; share gain 60,000; net +45,000', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const outcome = applyGoodEvent(d('1000000'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);

    expect(outcome.totalFee.eq(d('15000'))).toBe(true);
    expect(outcome.totalShareGain.eq(d('60000'))).toBe(true);
    expect(outcome.netDelta.eq(d('45000'))).toBe(true);
    expect(outcome.companyResults[0].priceAfter.eq(d('1300'))).toBe(true);
  });

  it('NOVA 200 shares, G1 Moderate: fee 7,500; gain 30,000; net +22,500', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const outcome = applyGoodEvent(d('1000000'), holdings, G1_PARAMS, 'MODERATE', FEE_RATE);

    expect(outcome.totalFee.eq(d('7500'))).toBe(true);
    expect(outcome.totalShareGain.eq(d('30000'))).toBe(true);
    expect(outcome.netDelta.eq(d('22500'))).toBe(true);
    expect(outcome.companyResults[0].priceAfter.eq(d('1150'))).toBe(true);
  });

  it('NOVA 80 shares, G1 Aggressive: fee 6,000', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 80, price: d('1000') },
    ];
    const outcome = applyGoodEvent(d('1000000'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);
    expect(outcome.totalFee.eq(d('6000'))).toBe(true);
  });

  it('G1 Pass: no fee, no move', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const outcome = applyGoodEvent(d('1000000'), holdings, G1_PARAMS, 'PASS', FEE_RATE);

    expect(outcome.totalFee.eq(d('0'))).toBe(true);
    expect(outcome.totalShareGain.eq(d('0'))).toBe(true);
    expect(outcome.companyResults[0].priceAfter.eq(d('1000'))).toBe(true);
  });
});

// ─── Good fee at price 1,000 per share table ────────────────────────

describe('Good fee at price 1,000 per share table', () => {
  const testCases = [
    { company: NOVA_ID, symbol: 'NOVA', aggFee: '75', modFee: '37.5', aggMove: d('0.30'), modMove: d('0.15') },
    { company: VOLT_ID, symbol: 'VOLT', aggFee: '55', modFee: '27.5', aggMove: d('0.22'), modMove: d('0.11') },
    { company: SHIPX_ID, symbol: 'SHIPX', aggFee: '35', modFee: '17.5', aggMove: d('0.14'), modMove: d('0.07') },
    { company: FINCO_ID, symbol: 'FINCO', aggFee: '45', modFee: '22.5', aggMove: d('0.18'), modMove: d('0.09') },
    { company: FRESH_ID, symbol: 'FRESH', aggFee: '25', modFee: '12.5', aggMove: d('0.10'), modMove: d('0.05') },
  ];

  for (const tc of testCases) {
    it(`${tc.symbol} Aggressive fee per share = ${tc.aggFee}`, () => {
      const { feePerShare } = calcGoodFee(d('1000'), 1, tc.aggMove, FEE_RATE);
      expect(feePerShare.eq(d(tc.aggFee))).toBe(true);
    });

    it(`${tc.symbol} Moderate fee per share = ${tc.modFee}`, () => {
      const { feePerShare } = calcGoodFee(d('1000'), 1, tc.modMove, FEE_RATE);
      expect(feePerShare.eq(d(tc.modFee))).toBe(true);
    });
  }
});

// ─── BAD EVENT: PDF examples ────────────────────────────────────────

describe('Bad Event - PDF Examples', () => {
  // After G1 Aggressive, NOVA price = 1300, 200 shares
  it('B1 Hold on NOVA after Aggressive (price 1300): loss 26,000, price to 1170', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1300') },
    ];
    const outcome = applyBadEvent(d('1000000'), holdings, B1_PARAMS, 'HOLD', EXIT_FACTOR);
    const novaResult = outcome.companyResults.find(r => r.companyId === NOVA_ID)!;

    expect(novaResult.priceAfter.eq(d('1170'))).toBe(true);
    expect(novaResult.holdingLoss.eq(d('26000'))).toBe(true);
  });

  it('B1 Sell Half on NOVA (price 1300, 200 shares)', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1300') },
    ];
    const outcome = applyBadEvent(d('1000000'), holdings, B1_PARAMS, 'SELL_HALF', EXIT_FACTOR);
    const novaResult = outcome.companyResults.find(r => r.companyId === NOVA_ID)!;

    // Sell 100 at 1300 x 0.92 = 119,600
    expect(novaResult.cashChange.eq(d('119600'))).toBe(true);
    // Cost of selling (vs holding value) = 100 × 1300 × 0.08 = 10,400
    // Remaining 100 at price 1170, loss = 100 × 130 = 13,000
    // Total loss = 10,400 + 13,000 = 23,400
    expect(novaResult.holdingLoss.eq(d('23400'))).toBe(true);
    expect(novaResult.sharesAfter).toBe(100);
    expect(novaResult.priceAfter.eq(d('1170'))).toBe(true);
  });

  it('B1 Exit on NOVA (price 1300, 200 shares): received 239,200, cost 20,800', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1300') },
    ];
    const outcome = applyBadEvent(d('1000000'), holdings, B1_PARAMS, 'EXIT', EXIT_FACTOR);
    const novaResult = outcome.companyResults.find(r => r.companyId === NOVA_ID)!;

    // 200 × 1300 × 0.92 = 239,200
    expect(novaResult.cashChange.eq(d('239200'))).toBe(true);
    // Cost = 200 × 1300 × 0.08 = 20,800
    expect(novaResult.holdingLoss.eq(d('20800'))).toBe(true);
    expect(novaResult.sharesAfter).toBe(0);
  });
});

// ─── Same-company different-price table ─────────────────────────────

describe('Same-company different-price table', () => {
  it('Team1: NOVA Aggressive then Hold -> price 1,170', () => {
    // Start: 200 shares, price 1000
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    // G1 Aggressive: price -> 1300
    const goodOutcome = applyGoodEvent(d('1000000'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);
    expect(goodOutcome.companyResults[0].priceAfter.eq(d('1300'))).toBe(true);

    // B1 Hold: price -> 1300 × 0.90 = 1170
    const updatedHoldings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1300') },
    ];
    const badOutcome = applyBadEvent(d('1000000'), updatedHoldings, B1_PARAMS, 'HOLD', EXIT_FACTOR);
    expect(badOutcome.companyResults[0].priceAfter.eq(d('1170'))).toBe(true);
  });

  it('Team2: NOVA Moderate then Hold -> price 1,035', () => {
    // G1 Moderate: price -> 1000 × 1.15 = 1150
    // B1 Hold: price -> 1150 × 0.90 = 1035
    const updatedHoldings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1150') },
    ];
    const badOutcome = applyBadEvent(d('1000000'), updatedHoldings, B1_PARAMS, 'HOLD', EXIT_FACTOR);
    expect(badOutcome.companyResults[0].priceAfter.eq(d('1035'))).toBe(true);
  });

  it('Team3: NOVA Pass then Hold -> price 900', () => {
    // Pass: price stays 1000
    // B1 Hold: price -> 1000 × 0.90 = 900
    const updatedHoldings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const badOutcome = applyBadEvent(d('1000000'), updatedHoldings, B1_PARAMS, 'HOLD', EXIT_FACTOR);
    expect(badOutcome.companyResults[0].priceAfter.eq(d('900'))).toBe(true);
  });

  it('Team4: NOVA Aggressive then Exit -> sold at 1,196', () => {
    // After Aggressive: price = 1300
    // Exit: sell at 1300 × 0.92 = 1196
    const updatedHoldings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1300') },
    ];
    const badOutcome = applyBadEvent(d('1000000'), updatedHoldings, B1_PARAMS, 'EXIT', EXIT_FACTOR);
    // Per share sale price = 1300 × 0.92 = 1196
    const perSharePrice = d('1300').mul(d('0.92'));
    expect(perSharePrice.eq(d('1196'))).toBe(true);
    expect(badOutcome.companyResults[0].cashChange.eq(d('239200'))).toBe(true); // 200 × 1196
  });
});

// ─── Good event downgrade logic ─────────────────────────────────────

describe('Good Event Downgrade', () => {
  it('downgrades Aggressive to Moderate when cash is insufficient', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    // Aggressive fee for 200 NOVA = 15,000. Give only 10,000 cash.
    // Moderate fee = 7,500, which is affordable.
    const result = determineEffectiveGoodOption(d('10000'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);
    expect(result.effectiveOption).toBe('MODERATE');
    expect(result.downgradedFrom).toBe('AGGRESSIVE');
  });

  it('downgrades Aggressive to Pass when cash is extremely low', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    // Both Aggressive (15,000) and Moderate (7,500) are too expensive
    const result = determineEffectiveGoodOption(d('5000'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);
    expect(result.effectiveOption).toBe('PASS');
    expect(result.downgradedFrom).toBe('AGGRESSIVE');
  });

  it('downgrades Moderate to Pass when cash is insufficient', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const result = determineEffectiveGoodOption(d('5000'), holdings, G1_PARAMS, 'MODERATE', FEE_RATE);
    expect(result.effectiveOption).toBe('PASS');
    expect(result.downgradedFrom).toBe('MODERATE');
  });

  it('Pass never downgrades', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const result = determineEffectiveGoodOption(d('0'), holdings, G1_PARAMS, 'PASS', FEE_RATE);
    expect(result.effectiveOption).toBe('PASS');
    expect(result.downgradedFrom).toBeNull();
  });
});

// ─── Net Worth ──────────────────────────────────────────────────────

describe('Net Worth', () => {
  it('computes correctly', () => {
    const holdings: CompanyHolding[] = [
      { companyId: 'a', symbol: 'A', shares: 100, price: d('1000') },
      { companyId: 'b', symbol: 'B', shares: 200, price: d('1500') },
    ];
    const nw = computeNetWorth(d('500000'), holdings);
    // 500,000 + 100×1000 + 200×1500 = 500,000 + 100,000 + 300,000 = 900,000
    expect(nw.eq(d('900000'))).toBe(true);
  });
});

// ─── SCORING TESTS ──────────────────────────────────────────────────

describe('Scoring - Financial Return', () => {
  it('single team gets 50', () => {
    const scores = computeFinancialReturn([{ teamId: 'a', netWorth: d('1000000') }]);
    expect(scores.get('a')!.eq(d('50'))).toBe(true);
  });

  it('rank 3 of 20 -> ~44.7', () => {
    // FR = 50 × (20 - 3) / (20 - 1) = 50 × 17/19 ≈ 44.7368
    const teams = Array.from({ length: 20 }, (_, i) => ({
      teamId: `team${i}`,
      netWorth: d(1000000 - i * 10000), // Descending
    }));
    const scores = computeFinancialReturn(teams);
    const rank3Score = scores.get('team2')!; // 0-indexed, team2 is rank 3
    expectDecimalClose(rank3Score, '44.7368', '0.01');
  });

  it('handles ties correctly', () => {
    const teams = [
      { teamId: 'a', netWorth: d('1000000') },
      { teamId: 'b', netWorth: d('1000000') },
      { teamId: 'c', netWorth: d('500000') },
    ];
    const scores = computeFinancialReturn(teams);
    // a and b tied for rank 1-2, avg rank = 1.5
    // Score = 50 × (3 - 1.5) / (3 - 1) = 50 × 1.5/2 = 37.5
    expect(scores.get('a')!.eq(d('37.5'))).toBe(true);
    expect(scores.get('b')!.eq(d('37.5'))).toBe(true);
    // c is rank 3
    // Score = 50 × (3 - 3) / (3 - 1) = 0
    expect(scores.get('c')!.eq(d('0'))).toBe(true);
  });
});

describe('Scoring - Decision Quality', () => {
  it('event with best choice scores 5', () => {
    const deltas: OptionDelta[] = [
      { option: 'AGGRESSIVE', netWorthDelta: d('45000'), affordable: true },
      { option: 'MODERATE', netWorthDelta: d('22500'), affordable: true },
      { option: 'PASS', netWorthDelta: d('0'), affordable: true },
    ];
    expect(computeEventDecisionScore(deltas, 'AGGRESSIVE').eq(d('5'))).toBe(true);
  });

  it('event with worst choice scores 0', () => {
    const deltas: OptionDelta[] = [
      { option: 'AGGRESSIVE', netWorthDelta: d('45000'), affordable: true },
      { option: 'MODERATE', netWorthDelta: d('22500'), affordable: true },
      { option: 'PASS', netWorthDelta: d('0'), affordable: true },
    ];
    expect(computeEventDecisionScore(deltas, 'PASS').eq(d('0'))).toBe(true);
  });

  it('event with middle choice scores proportionally', () => {
    const deltas: OptionDelta[] = [
      { option: 'AGGRESSIVE', netWorthDelta: d('45000'), affordable: true },
      { option: 'MODERATE', netWorthDelta: d('22500'), affordable: true },
      { option: 'PASS', netWorthDelta: d('0'), affordable: true },
    ];
    // 5 × (22500 - 0) / (45000 - 0) = 2.5
    expect(computeEventDecisionScore(deltas, 'MODERATE').eq(d('2.5'))).toBe(true);
  });

  it('returns 2.5 when best == worst', () => {
    const deltas: OptionDelta[] = [
      { option: 'HOLD', netWorthDelta: d('0'), affordable: true },
      { option: 'SELL_HALF', netWorthDelta: d('0'), affordable: true },
      { option: 'EXIT', netWorthDelta: d('0'), affordable: true },
    ];
    expect(computeEventDecisionScore(deltas, 'HOLD').eq(d('2.5'))).toBe(true);
  });

  it('returns 2.5 when no affected shares (empty deltas)', () => {
    const deltas: OptionDelta[] = [];
    expect(computeEventDecisionScore(deltas, 'HOLD').eq(d('2.5'))).toBe(true);
  });
});

describe('Scoring - Diversification', () => {
  it('maps company counts correctly', () => {
    expect(computeDiversificationScore(0).eq(d('0'))).toBe(true);
    expect(computeDiversificationScore(1).eq(d('0'))).toBe(true);
    expect(computeDiversificationScore(2).eq(d('0'))).toBe(true);
    expect(computeDiversificationScore(3).eq(d('4'))).toBe(true);
    expect(computeDiversificationScore(4).eq(d('6'))).toBe(true);
    expect(computeDiversificationScore(5).eq(d('8'))).toBe(true);
    expect(computeDiversificationScore(6).eq(d('10'))).toBe(true);
  });
});

describe('Scoring - Downside Control', () => {
  it('team with no bad event losses gets 10', () => {
    expect(computeDownsideControl(d('5000'), d('50000')).eq(d('10'))).toBe(true);
  });

  it('team with max loss gets 0', () => {
    expect(computeDownsideControl(d('-50000'), d('50000')).eq(d('0'))).toBe(true);
  });

  it('team with partial loss scores proportionally', () => {
    // teamBadEventDelta = -20000, maxLoss = 50000
    // teamLoss = 20000
    // score = 10 × (1 - 20000/50000) = 10 × 0.6 = 6
    expect(computeDownsideControl(d('-20000'), d('50000')).eq(d('6'))).toBe(true);
  });

  it('if maxLoss == 0, everyone gets 10', () => {
    expect(computeDownsideControl(d('0'), d('0')).eq(d('10'))).toBe(true);
  });
});

describe('Scoring - Judge Bonus', () => {
  it('computes average and rounds to nearest', () => {
    const scores = [
      { clarity: 1, justification: 1, answerQuality: 1 }, // 3
      { clarity: 1, justification: 0, answerQuality: 1 }, // 2
    ];
    // avg = 2.5, rounds to 3 (half up)
    expect(computeJudgeBonus(scores)).toBe(3);
  });

  it('caps at 3', () => {
    const scores = [
      { clarity: 1, justification: 1, answerQuality: 1 },
      { clarity: 1, justification: 1, answerQuality: 1 },
    ];
    expect(computeJudgeBonus(scores)).toBe(3);
  });

  it('returns 0 with no judges', () => {
    expect(computeJudgeBonus([])).toBe(0);
  });
});

describe('Scoring - Worked Example', () => {
  it('rank 3 of 20 -> FR ~44.7; DQ 25.0; RM 14.0; auto 83.7; final 85.7', () => {
    // Financial Return: 50 × (20-3)/(20-1) = 50 × 17/19 ≈ 44.7368...
    const fr = new Decimal(50).mul(new Decimal(17)).div(new Decimal(19));

    // Decision Quality: 5 + 4.2 + 3.8 + 5 + 2.5 + 4.5 = 25.0
    const dqEvents = [d('5'), d('4.2'), d('3.8'), d('5'), d('2.5'), d('4.5')];
    const dq = computeDecisionQuality(dqEvents);
    expect(dq.eq(d('25'))).toBe(true);

    // Risk Management: diversification 6 + downside 8 = 14
    const div = d('6');
    const down = d('8');
    const rm = computeRiskManagement(div, down);
    expect(rm.eq(d('14'))).toBe(true);

    // Auto = FR + DQ + RM
    const auto = computeAutoScore(fr, dq, rm);
    expectDecimalClose(auto, '83.7368', '0.01');

    // Judge bonus 2
    const finalScore = auto.plus(d('2'));
    expectDecimalClose(finalScore, '85.7368', '0.01');
  });
});

// ─── BRUTE FORCE PORTFOLIO ANALYSIS ─────────────────────────────────

describe('Brute Force Portfolio Analysis', () => {
  function makeHoldings(shares: Record<string, number>): CompanyHolding[] {
    const holdingsMap: Record<string, { symbol: string }> = {
      [NOVA_ID]: { symbol: 'NOVA' },
      [VOLT_ID]: { symbol: 'VOLT' },
      [SHIPX_ID]: { symbol: 'SHIPX' },
      [FINCO_ID]: { symbol: 'FINCO' },
      [FRESH_ID]: { symbol: 'FRESH' },
      [MEDIX_ID]: { symbol: 'MEDIX' },
    };

    return Object.entries(shares).map(([id, qty]) => ({
      companyId: id,
      symbol: holdingsMap[id]?.symbol || id,
      shares: qty,
      price: d('1000'),
    }));
  }

  // Balanced: 100 shares in each of the 6 companies
  // Total investment = 6 × 100 × 1000 = 600,000
  // Cash = 1,000,000 - 600,000 = 400,000
  it('Balanced portfolio: worst -48,000, best +24,560, 23% above zero, aggressive-all-good worst +14,980', () => {
    const holdings = makeHoldings({
      [NOVA_ID]: 100, [VOLT_ID]: 100, [SHIPX_ID]: 100,
      [FINCO_ID]: 100, [FRESH_ID]: 100, [MEDIX_ID]: 100,
    });
    const startingCash = d('400000');

    const result = bruteForceAnalysis(
      startingCash, holdings, ALL_GOOD_EVENTS, ALL_BAD_EVENTS, FEE_RATE, EXIT_FACTOR,
    );

    expect(result.totalPaths).toBe(729);

    // From spec: worst -48,000
    expectDecimalClose(result.worstDelta, '-48000', '1');
    // best +24,560
    expectDecimalClose(result.bestDelta, '24560', '1');
    // 23% above zero
    const pct = result.aboveZeroCount / result.totalPaths * 100;
    expect(Math.round(pct)).toBe(23);
    // worst with all aggressive good = +14,980
    expectDecimalClose(result.worstWithAllAggressive, '14980', '1');
  });

  // Aggressive: 200 each NOVA, VOLT, FINCO
  // Investment = 3 × 200 × 1000 = 600,000; Cash = 400,000
  it('Aggressive portfolio: worst -50,000, best +50,040, 50% above zero, agg-all-good worst +43,360', () => {
    const holdings = makeHoldings({
      [NOVA_ID]: 200, [VOLT_ID]: 200, [FINCO_ID]: 200,
    });
    const startingCash = d('400000');

    const result = bruteForceAnalysis(
      startingCash, holdings, ALL_GOOD_EVENTS, ALL_BAD_EVENTS, FEE_RATE, EXIT_FACTOR,
    );

    expectDecimalClose(result.worstDelta, '-50000', '1');
    expectDecimalClose(result.bestDelta, '50040', '1');
    const pct = result.aboveZeroCount / result.totalPaths * 100;
    expect(Math.round(pct)).toBe(50);
    expectDecimalClose(result.worstWithAllAggressive, '43360', '1');
  });

  // Defensive: 200 each FINCO, FRESH, SHIPX
  it('Defensive portfolio: worst -48,000, best +31,080, 35% above zero, agg-all-good worst +8,280', () => {
    const holdings = makeHoldings({
      [FINCO_ID]: 200, [FRESH_ID]: 200, [SHIPX_ID]: 200,
    });
    const startingCash = d('400000');

    const result = bruteForceAnalysis(
      startingCash, holdings, ALL_GOOD_EVENTS, ALL_BAD_EVENTS, FEE_RATE, EXIT_FACTOR,
    );

    expectDecimalClose(result.worstDelta, '-48000', '1');
    expectDecimalClose(result.bestDelta, '31080', '1');
    const pct = result.aboveZeroCount / result.totalPaths * 100;
    expect(Math.round(pct)).toBe(35);
    expectDecimalClose(result.worstWithAllAggressive, '8280', '1');
  });

  // Trap: 200 each MEDIX, NOVA, FRESH
  it('Trap portfolio: worst -52,000, best +18,400, 20% above zero, agg-all-good worst +400', () => {
    const holdings = makeHoldings({
      [MEDIX_ID]: 200, [NOVA_ID]: 200, [FRESH_ID]: 200,
    });
    const startingCash = d('400000');

    const result = bruteForceAnalysis(
      startingCash, holdings, ALL_GOOD_EVENTS, ALL_BAD_EVENTS, FEE_RATE, EXIT_FACTOR,
    );

    expectDecimalClose(result.worstDelta, '-52000', '1');
    expectDecimalClose(result.bestDelta, '18400', '1');
    const pct = result.aboveZeroCount / result.totalPaths * 100;
    expect(Math.round(pct)).toBe(20);
    expectDecimalClose(result.worstWithAllAggressive, '400', '1');
  });
});

// ─── INVARIANT / PROPERTY TESTS ─────────────────────────────────────

describe('Invariants', () => {
  it('cash never goes below 0 after good event', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    // Even with very low cash, the downgrade should prevent negative cash
    const outcome = applyGoodEvent(d('100'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);
    expect(outcome.cashAfter.gte(d('0'))).toBe(true);
    expect(outcome.effectiveOption).toBe('PASS'); // Should downgrade to Pass
  });

  it('shares never go below 0 after bad event', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 1, price: d('1000') },
    ];
    const outcome = applyBadEvent(d('1000000'), holdings, B1_PARAMS, 'EXIT', EXIT_FACTOR);
    const novaResult = outcome.companyResults.find(r => r.companyId === NOVA_ID)!;
    expect(novaResult.sharesAfter).toBeGreaterThanOrEqual(0);
  });

  it('replaying a team ledger twice gives identical state', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
      { companyId: VOLT_ID, symbol: 'VOLT', shares: 100, price: d('1000') },
    ];

    // Run the same sequence twice
    for (let run = 0; run < 2; run++) {
      let cash = d('400000');
      const h = holdings.map(hh => ({ ...hh, price: new Decimal(hh.price) }));

      // Good event
      const g1 = applyGoodEvent(cash, h, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);
      cash = g1.cashAfter;
      for (const cr of g1.companyResults) {
        const hh = h.find(hhh => hhh.companyId === cr.companyId);
        if (hh) hh.price = cr.priceAfter;
      }

      // Bad event
      const b1 = applyBadEvent(cash, h, B1_PARAMS, 'HOLD', EXIT_FACTOR);
      cash = b1.cashAfter;

      if (run === 0) {
        // Store first run results
        (globalThis as any).__testCash1 = cash.toString();
      } else {
        expect(cash.toString()).toBe((globalThis as any).__testCash1);
      }
    }
  });

  it('Decimal results never use floats', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const outcome = applyGoodEvent(d('1000000'), holdings, G1_PARAMS, 'AGGRESSIVE', FEE_RATE);

    // All results should be Decimal instances
    expect(outcome.totalFee).toBeInstanceOf(Decimal);
    expect(outcome.totalShareGain).toBeInstanceOf(Decimal);
    expect(outcome.netDelta).toBeInstanceOf(Decimal);
    expect(outcome.cashAfter).toBeInstanceOf(Decimal);
    for (const cr of outcome.companyResults) {
      expect(cr.priceBefore).toBeInstanceOf(Decimal);
      expect(cr.priceAfter).toBeInstanceOf(Decimal);
      expect(cr.feePerShare).toBeInstanceOf(Decimal);
      expect(cr.totalFee).toBeInstanceOf(Decimal);
      expect(cr.shareGain).toBeInstanceOf(Decimal);
    }
  });
});

// ─── INR Formatting ─────────────────────────────────────────────────

describe('INR Formatting', () => {
  it('formats 10,00,000 correctly', () => {
    const formatted = formatINR(d('1000000'));
    expect(formatted).toContain('10,00,000');
  });

  it('formats small amounts', () => {
    const formatted = formatINR(d('15000'));
    expect(formatted).toContain('15,000');
  });
});

// ─── Option Deltas for scoring ──────────────────────────────────────

describe('Option Deltas', () => {
  it('computes good event option deltas correctly', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1000') },
    ];
    const deltas = computeGoodOptionDeltas(d('1000000'), holdings, G1_PARAMS, FEE_RATE);

    // AGGRESSIVE: gain 60,000 - fee 15,000 = 45,000
    const aggDelta = deltas.find(dd => dd.option === 'AGGRESSIVE')!;
    expect(aggDelta.netWorthDelta.eq(d('45000'))).toBe(true);
    expect(aggDelta.affordable).toBe(true);

    // MODERATE: gain 30,000 - fee 7,500 = 22,500
    const modDelta = deltas.find(dd => dd.option === 'MODERATE')!;
    expect(modDelta.netWorthDelta.eq(d('22500'))).toBe(true);

    // PASS: 0
    const passDelta = deltas.find(dd => dd.option === 'PASS')!;
    expect(passDelta.netWorthDelta.eq(d('0'))).toBe(true);
  });

  it('computes bad event option deltas correctly', () => {
    const holdings: CompanyHolding[] = [
      { companyId: NOVA_ID, symbol: 'NOVA', shares: 200, price: d('1300') },
    ];
    const deltas = computeBadOptionDeltas(d('1000000'), holdings, B1_PARAMS, EXIT_FACTOR);

    // HOLD: loss = -26,000 on NOVA
    const holdDelta = deltas.find(dd => dd.option === 'HOLD')!;
    expect(holdDelta.netWorthDelta.eq(d('-26000'))).toBe(true);

    // EXIT: cash received 239,200 - holding loss 20,800; net delta = cash - loss on value
    // Actually: net delta = cashChange - holdingLoss = 239200 - (200 × 1300 × 0.08) = 239200 - 20800
    // But netDelta = totalCashChange - totalHoldingLoss = 239200 - 20800 = ... wait
    // Actually netDelta = cashChange - holdingValue = exit gives you cashChange but you lose the holding
    // Let me recalculate: net worth delta = (cashAfter - cashBefore) + (holdings value after - holdings value before)
    // EXIT: cashChange = +239200, holdingsAfter = 0, holdingsBefore = 200 × 1300 = 260,000
    // netDelta = 239200 + (0 - 260000) = -20800
    const exitDelta = deltas.find(dd => dd.option === 'EXIT')!;
    expect(exitDelta.netWorthDelta.eq(d('-20800'))).toBe(true);
  });
});
