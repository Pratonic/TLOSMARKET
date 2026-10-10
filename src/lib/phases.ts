/**
 * Game phase constants and utilities (Dynamic).
 */

export function computeDynamicPhases(goodCount: number, badCount: number): string[] {
  const phases = ['PORTFOLIO'];
  for (let i = 1; i <= goodCount; i++) phases.push(`GOOD_${i}`);
  phases.push('REVEAL_GOOD');
  for (let i = 1; i <= badCount; i++) phases.push(`BAD_${i}`);
  phases.push('REVEAL_BAD', 'FINAL_DECISION', 'END');
  return phases;
}

export function getNextPhase(current: string, goodCount: number, badCount: number): string | null {
  const phases = computeDynamicPhases(goodCount, badCount);
  const idx = phases.indexOf(current);
  if (idx === -1 || idx >= phases.length - 1) return null;
  return phases[idx + 1];
}

export function getPhaseEventCode(phase: string): string | null {
  if (phase.startsWith('GOOD_')) {
    const num = phase.split('_')[1];
    return `G${num}`;
  }
  if (phase.startsWith('BAD_')) {
    const num = phase.split('_')[1];
    return `B${num}`;
  }
  return null;
}

export function isEventPhase(phase: string): boolean {
  return phase.startsWith('GOOD_') || phase.startsWith('BAD_');
}

export function isGoodEventPhase(phase: string): boolean {
  return phase.startsWith('GOOD_');
}

export function isBadEventPhase(phase: string): boolean {
  return phase.startsWith('BAD_');
}

/** Which snapshot milestone is the latest that players can see */
export function getPlayerVisibleMilestone(phase: string, goodCount: number, badCount: number): string {
  const phases = computeDynamicPhases(goodCount, badCount);
  const currentIdx = phases.indexOf(phase);
  if (currentIdx >= phases.indexOf('REVEAL_BAD')) return 'REVEAL_BAD';
  if (currentIdx >= phases.indexOf('REVEAL_GOOD')) return 'REVEAL_GOOD';
  return 'PORTFOLIO';
}
