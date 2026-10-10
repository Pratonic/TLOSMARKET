import fs from 'fs';

const path = 'src/lib/engine/index.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /export function applyGoodEvent\([\s\S]*?return \{\n\s*option: chosenOption,\s*effectiveOption: chosenOption,\s*downgradedFrom: null,\s*totalFee: new Decimal\(0\),\s*totalShareGain,\s*netDelta,\s*cashAfter: currentCash,\s*companyResults,\s*\};\s*\}/;

const newFunc = `export function applyGoodEvent(
  cash: Decimal,
  holdings: CompanyHolding[],
  eventParams: GoodEventCompanyParams[],
  chosenOption: GoodOption,
  feeRate: Decimal, // 0.25
): GoodEventOutcome {
  let effectiveOption = chosenOption;
  let downgradedFrom: GoodOption | null = null;
  let companyResults: GoodEventResult[] = [];
  let totalFee = new Decimal(0);
  let totalShareGain = new Decimal(0);

  // Downgrade logic: loop from chosenOption down to PASS if cash is insufficient.
  const optionsToTry: GoodOption[] = [];
  if (chosenOption === 'AGGRESSIVE') optionsToTry.push('AGGRESSIVE', 'MODERATE', 'PASS');
  else if (chosenOption === 'MODERATE') optionsToTry.push('MODERATE', 'PASS');
  else optionsToTry.push('PASS');

  for (const opt of optionsToTry) {
    let tentativeTotalFee = new Decimal(0);
    let tentativeResults: GoodEventResult[] = [];
    let tentativeTotalGain = new Decimal(0);

    for (const param of eventParams) {
      const holding = holdings.find(h => h.companyId === param.companyId);
      if (!holding || holding.shares <= 0) continue;

      const moveFraction = opt === 'AGGRESSIVE' ? param.aggressiveMove
        : opt === 'MODERATE' ? param.moderateMove
        : new Decimal(0);

      const priceBefore = holding.price;
      const priceGain = priceBefore.mul(moveFraction);
      const feePerShare = priceGain.mul(feeRate); // 25% of the move
      const compTotalFee = feePerShare.mul(holding.shares);
      
      const priceAfter = priceBefore.plus(priceGain);
      const shareGain = priceGain.mul(holding.shares);

      tentativeTotalFee = tentativeTotalFee.plus(compTotalFee);
      tentativeTotalGain = tentativeTotalGain.plus(shareGain);

      tentativeResults.push({
        companyId: param.companyId,
        symbol: param.symbol,
        sharesBefore: holding.shares,
        sharesAfter: holding.shares,
        priceBefore,
        priceAfter,
        feePerShare,
        totalFee: compTotalFee,
        shareGain,
      });
    }

    if (cash.gte(tentativeTotalFee) || opt === 'PASS') {
      effectiveOption = opt;
      if (opt !== chosenOption) downgradedFrom = chosenOption;
      companyResults = tentativeResults;
      totalFee = tentativeTotalFee;
      totalShareGain = tentativeTotalGain;
      break;
    }
  }

  const netDelta = totalShareGain.minus(totalFee);

  return {
    option: chosenOption,
    effectiveOption,
    downgradedFrom,
    totalFee,
    totalShareGain,
    netDelta,
    cashAfter: cash.minus(totalFee),
    companyResults,
  };
}`;

code = code.replace(regex, newFunc);
fs.writeFileSync(path, code);
console.log('Replaced applyGoodEvent');
