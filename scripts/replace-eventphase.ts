import fs from 'fs';

const path = 'src/app/play/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `function EventPhase({ state, mutate }: { state: any, mutate: any }) {
  const { currentEvent, marketOpen } = state;
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  if (!currentEvent) return null;

  const isLocked = !!currentEvent.currentChoice;
  const activeChoice = currentEvent.currentChoice || selectedOption;

  const handleConfirm = async () => {
    if (!selectedOption) return toast.error("NO OPTION SELECTED", { description: "Please select an option first." });
    if (!marketOpen) return toast.error("MARKET CLOSED", { description: "Cannot submit strategy right now." });
    setLoading(true);
    try {
      const res = await fetch("/api/me/choice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: currentEvent.eventId, option: selectedOption }) });
      if (!res.ok) throw new Error((await res.json()).error || "Submission failed");
      toast.success("STRATEGY LOCKED", { className: "font-mono border-orange-500/50 bg-black/90 text-orange-500" });
      mutate();
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const isGood = currentEvent.kind === 'GOOD';

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", damping: 25 }}>
      <Card className={\`border-2 overflow-hidden shadow-2xl bg-card/80 backdrop-blur-md \${isGood ? 'border-profit/50 shadow-profit/10' : 'border-loss/50 shadow-loss/10'}\`}>
        <div className={\`h-2 w-full \${isGood ? 'bg-profit' : 'bg-loss'}\`} />
        <CardHeader className="pb-8 border-b border-border/30 bg-black/20">
          <div className="flex justify-between items-start mb-6">
            <span className={\`px-4 py-1.5 rounded-full text-xs font-black tracking-widest \${isGood ? 'bg-profit/20 text-profit border border-profit/50' : 'bg-loss/20 text-loss border border-loss/50'}\`}>
              {currentEvent.code} | {currentEvent.kind} CATALYST
            </span>
            {marketOpen && (
              isLocked ? (
                <span className="flex items-center gap-2 text-xs font-mono text-orange-500"><CheckCircle size={14}/> STRATEGY LOCKED</span>
              ) : (
                <span className="animate-pulse flex items-center gap-2 text-xs font-mono text-primary"><Activity size={14}/> AWAITING INPUT</span>
              )
            )}
          </div>
          <CardTitle className="text-4xl font-black leading-tight">{currentEvent.title}</CardTitle>
          <CardDescription className="text-xl mt-6 text-foreground/80 font-serif leading-relaxed border-l-4 border-primary/50 pl-6 py-2 bg-gradient-to-r from-primary/5 to-transparent">
            {currentEvent.questionText}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-8 space-y-8">
          <div>
            <h4 className="text-sm font-mono tracking-widest text-muted-foreground mb-4">SELECT STRATEGY PROJECTION</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {currentEvent.options.map((opt: string) => {
                const isSelected = activeChoice === opt;
                // Once locked, it's orange. Before lock, selection is maybe just highlighted lightly or orange too.
                const lockedClass = isLocked 
                  ? (isSelected ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-[1.02]' : 'opacity-50 border-border/50')
                  : (isSelected ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-[1.02]' : 'hover:border-orange-500/50 hover:bg-white/[0.02]');
                  
                return (
                  <Button
                    key={opt}
                    variant="outline"
                    className={\`h-20 text-lg font-black tracking-wide border-2 transition-all duration-300 \${lockedClass}\`}
                    onClick={() => !isLocked && setSelectedOption(opt)}
                    disabled={loading || !marketOpen || isLocked}
                  >
                    {isSelected && <CheckCircle className={\`mr-3 \${isLocked ? 'text-orange-500' : 'text-orange-500 animate-bounce'}\`} size={24} />}
                    {opt.replace("_", " ")}
                  </Button>
                )
              })}
            </div>
            
            {!isLocked && (
              <div className="mt-8 flex justify-end">
                <Button 
                  size="lg" 
                  onClick={handleConfirm} 
                  disabled={!selectedOption || loading || !marketOpen}
                  className="font-black tracking-widest bg-orange-500 hover:bg-orange-600 text-black px-12 h-14"
                >
                  {loading ? "LOCKING..." : "CONFIRM SELECTION"}
                </Button>
              </div>
            )}
          </div>
          
          {currentEvent.affectedCompanies.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="p-6 bg-black/40 rounded-xl border border-border/50">
              <h4 className="text-sm font-mono tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Target size={16} /> EXPOSED ASSETS
              </h4>
              <div className="flex flex-wrap gap-3">
                {currentEvent.affectedCompanies.map((c: any) => (
                  <div key={c.companyId} className="flex items-center gap-3 px-4 py-2 bg-background/50 border border-border rounded-lg shadow-inner">
                    <span className="font-bold text-lg text-primary">{c.company.symbol}</span>
                    <span className="text-muted-foreground text-sm font-mono">{c.company.sector}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}`;

// Need to match exactly function EventPhase to its end
const regex = /function EventPhase\([\s\S]*?\}\s*\}\)\}\s*<\/div>\s*<\/motion\.div>\s*\)\}\s*<\/CardContent>\s*<\/Card>\s*<\/motion\.div>\s*\);\s*\}/;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Replaced EventPhase');
