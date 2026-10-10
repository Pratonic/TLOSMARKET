import fs from 'fs';

let content = fs.readFileSync('src/app/admin/page.tsx', 'utf-8');

// Replace LiveLeaderboard signature
content = content.replace(
  'function LiveLeaderboard({ leaderboard, scores, events, gamePhase, mutate }: { leaderboard: any[], scores: any[], events: any[], gamePhase: string, mutate: any }) {',
  'function LiveLeaderboard({ leaderboard, scores, events, gamePhase, mutate }: { leaderboard: any[], scores: any[], events: any[], gamePhase: string, mutate: any }) {'
);

// We want to add the score block in the header row
const headerReplacement = `
              <div className="flex items-center gap-8">
                {scores && (() => {
                  const sc = scores.find((s: any) => s.teamId === team.id);
                  return sc ? (
                    <div className="text-right border-r border-border/50 pr-8 hidden md:block">
                      <p className="text-[10px] text-muted-foreground font-mono tracking-widest mb-1 opacity-70">AUTO SCORE</p>
                      <p className="font-black font-mono text-white text-3xl tracking-tight drop-shadow-md">
                        {sc.autoScore.toFixed(1)} <span className="text-sm text-muted-foreground font-normal">pts</span>
                      </p>
                    </div>
                  ) : null;
                })()}
                <div className="text-right">
`;
content = content.replace(/<div className="flex items-center gap-8">\s*<div className="text-right">/, headerReplacement);

// We want to add the score breakdown in the expanded div.
const expandedReplacement = `
                    <div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
                      {scores && (() => {
                        const sc = scores.find((s: any) => s.teamId === team.id);
                        if (!sc) return null;
                        return (
                          <div className="space-y-4 xl:col-span-3 border-b border-border/50 pb-6 mb-2">
                            <h4 className="text-primary font-bold text-sm tracking-widest flex items-center gap-2 border-b border-border/50 pb-2">
                              EVALUATION SYSTEM BREAKDOWN
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-muted/10 rounded-lg border border-border/30 flex flex-col justify-between">
                                <span className="text-muted-foreground font-mono text-xs">FINANCIAL RETURN</span>
                                <span className="font-mono font-bold text-2xl text-white">{sc.financialReturn.toFixed(1)} <span className="text-sm">/ 50</span></span>
                              </div>
                              <div className="p-4 bg-muted/10 rounded-lg border border-border/30 flex flex-col justify-between">
                                <span className="text-muted-foreground font-mono text-xs">DECISION QUALITY</span>
                                <span className="font-mono font-bold text-2xl text-white">{sc.decisionQuality.toFixed(1)} <span className="text-sm">/ 30</span></span>
                              </div>
                              <div className="p-4 bg-muted/10 rounded-lg border border-border/30 flex flex-col justify-between">
                                <span className="text-muted-foreground font-mono text-xs">RISK MANAGEMENT</span>
                                <span className="font-mono font-bold text-2xl text-white">{sc.riskManagement.toFixed(1)} <span className="text-sm">/ 20</span></span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* NW Breakdown */}
`;
content = content.replace(/<div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8">\s*\{\/\* NW Breakdown \*\/\}/, expandedReplacement);

fs.writeFileSync('src/app/admin/page.tsx', content);
console.log('Patched LiveLeaderboard');
