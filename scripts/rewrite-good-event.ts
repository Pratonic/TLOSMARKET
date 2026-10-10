import fs from 'fs';

const path = 'src/lib/engine/index.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `export function applyGoodEvent(
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
`;

const regex = /export function applyGoodEvent\([\s\S]*?companyResults,\s*\}\;\s*\}/;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Replaced applyGoodEvent');
