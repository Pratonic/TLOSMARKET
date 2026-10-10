import fs from 'fs';

const path = 'src/app/admin/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const curEvent = state\.events\?\.find\(\(e: any\) => e\.code === state\.game\.phase\);/;
const replacement = `const eventCodeMap: Record<string, string> = { "GOOD_1": "G1", "GOOD_2": "G2", "GOOD_3": "G3", "BAD_1": "B1", "BAD_2": "B2", "BAD_3": "B3" };
        const mappedCode = eventCodeMap[state.game.phase] || state.game.phase;
        const curEvent = state.events?.find((e: any) => e.code === mappedCode);`;

if (!regex.test(content)) {
  console.log("Could not find regex!");
  process.exit(1);
}

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log("Successfully replaced event code mapper");
