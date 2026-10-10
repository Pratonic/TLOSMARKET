import fs from 'fs';

let content = fs.readFileSync('src/lib/resolve.ts', 'utf-8');

const regex = /let chosenOption = choice\?\.option;\s*if \(\!chosenOption\) \{\s*chosenOption = eventDef\.kind === 'GOOD' \? 'PASS' : 'HOLD';\s*\}/;

const replacement = `let chosenOption = choice?.option;
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
    }`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/lib/resolve.ts', content);
