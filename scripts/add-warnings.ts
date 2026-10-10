import fs from 'fs';

let content = fs.readFileSync('src/app/admin/page.tsx', 'utf-8');

const confirmFunction = `
  function confirmPhaseAdvance(p: string) {
    let warningMsg = "";
    if (state.game.phase === "PORTFOLIO" && p !== "PORTFOLIO") {
      const teamsMissing = state.leaderboard.filter((t: any) => t.holdings.filter((h: any) => h.shares > 0).length < 3);
      if (teamsMissing.length > 0) {
        warningMsg = "WARNING: The following teams haven't invested in at least 3 companies:\\n" + teamsMissing.map((t: any) => "- " + t.name).join("\\n") + "\\n\\nAre you sure you want to advance to " + p + "?";
      }
    } else if ((state.game.phase.startsWith("GOOD_") || state.game.phase.startsWith("BAD_")) && p !== state.game.phase) {
      const curEvent = state.events?.find((e: any) => e.code === state.game.phase);
      if (curEvent) {
        const teamsMissing = state.leaderboard.filter((t: any) => !t.choices.some((c: any) => c.eventId === curEvent.id));
        if (teamsMissing.length > 0) {
          warningMsg = "WARNING: The following teams HAVEN'T made a choice for " + state.game.phase + ":\\n" + teamsMissing.map((t: any) => "- " + t.name).join("\\n") + "\\n\\nAre you sure you want to advance to " + p + "?";
        }
      }
    }

    if (warningMsg) {
      if (confirm(warningMsg)) handleSetPhase(p, mutate);
    } else {
      if (confirm(\`Force transition to \${p}?\`)) handleSetPhase(p, mutate);
    }
  }
`;

// Insert the confirmFunction right inside the AdminDashboard component, before `return (`
content = content.replace('const badCount = state.events?.filter((e: any) => e.kind === \'BAD\').length || 3;', 'const badCount = state.events?.filter((e: any) => e.kind === \'BAD\').length || 3;\n' + confirmFunction);

// Update the onClick
content = content.replace('onClick={() => { if(confirm(`Force transition to ${p}?`)) handleSetPhase(p, mutate); }}', 'onClick={() => confirmPhaseAdvance(p)}');

fs.writeFileSync('src/app/admin/page.tsx', content);
