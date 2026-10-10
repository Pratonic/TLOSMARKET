"use client";

import useSWR from "swr";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Briefcase, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Save, Clock, Target, Server } from "lucide-react";
import { Label } from "@/components/ui/label";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 }
};

export default function PlayPage() {
  const { data: state, error, isLoading, mutate } = useSWR("/api/me/state", fetcher, { refreshInterval: 2000 });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <motion.div animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex flex-col items-center gap-4 text-primary">
          <Server size={48} />
          <p className="font-mono text-xl tracking-widest">CONNECTING TO TERMINAL...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !state || state.error || !state.phase) {
    if (state?.error === 'Unauthorized') {
      if (typeof window !== 'undefined') window.location.href = '/login';
      return null;
    }
    return <div className="flex h-screen items-center justify-center font-mono text-destructive text-2xl tracking-widest">{state?.error?.toUpperCase() || "CONNECTION LOST. PLEASE REFRESH."}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 relative z-10 text-foreground">
      <Header state={state} />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <AnimatePresence mode="wait">
            {state.phase === "PORTFOLIO" && <PortfolioPhase key="portfolio" state={state} mutate={mutate} />}
            {(state.phase.startsWith("GOOD_") || state.phase.startsWith("BAD_")) && <EventPhase key={`event-${state.phase}`} state={state} mutate={mutate} />}
            {(state.phase === "REVEAL_GOOD" || state.phase === "REVEAL_BAD") && <RevealPhase key="reveal" state={state} />}
            {state.phase === "FINAL_DECISION" && <FinalDecisionPhase key="final" state={state} mutate={mutate} />}
            {state.phase === "END" && <EndPhase key="end" state={state} />}
          </AnimatePresence>
        </div>
        
        <div className="lg:col-span-1">
          <HoldingsPanel holdings={state.holdings || []} />
        </div>
      </div>
    </div>
  );
}

function Header({ state }: { state: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 20 }} className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-lg shadow-black/50">
        <CardContent className="p-5 flex flex-col items-center justify-center h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Activity size={64}/></div>
          <p className="text-xs text-muted-foreground font-mono tracking-widest mb-1">STATUS</p>
          <div className={`flex items-center gap-2 mt-1 font-bold text-lg tracking-wider ${state.marketOpen ? 'text-profit drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]' : 'text-loss drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]'}`}>
            {state.marketOpen ? <PlayCircle /> : <PauseCircle />}
            {state.marketOpen ? "OPEN" : "CLOSED"}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card/60 backdrop-blur-md md:col-span-3 shadow-lg shadow-black/50 relative overflow-hidden group hover:border-primary/50 transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 group-hover:bg-primary transition-colors"/>
        <CardContent className="p-6 flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground font-mono tracking-widest mb-2">PORTFOLIO VALUATION</p>
          <p className="text-5xl font-black font-mono text-primary drop-shadow-[0_0_15px_rgba(255,215,0,0.2)]">
            {formatCurrency(Number(state.netWorth) || 0)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-lg shadow-black/50">
        <CardContent className="p-5 flex flex-col items-center justify-center h-full">
          <p className="text-xs text-muted-foreground font-mono tracking-widest mb-1">LIQUIDITY</p>
          <p className="text-2xl font-bold font-mono mt-1 text-foreground">
            {formatCurrency(Number(state.cash) || 0)}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PlayCircle() { return <Clock size={20} className="animate-pulse"/>; }
function PauseCircle() { return <AlertTriangle size={20}/>; }

function HoldingsPanel({ holdings }: { holdings: any[] }) {
  const myHoldings = holdings.filter(h => h.shares > 0);

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-md h-[calc(100vh-140px)] sticky top-6 flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/30 bg-black/40">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-primary tracking-wide">
          <Briefcase size={20} />
          POSITIONS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        {myHoldings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-6 text-center">
            <Target size={48} className="mb-4" />
            <p className="font-mono text-sm tracking-widest">AWAITING ALLOCATIONS</p>
          </div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="divide-y divide-border/30">
            {myHoldings.map((h, i) => (
              <motion.div variants={item} key={i} className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors group">
                <div>
                  <p className="font-bold text-lg group-hover:text-primary transition-colors">{h.symbol || h.companyName}</p>
                  <p className="text-sm text-muted-foreground font-mono mt-1 px-2 py-0.5 bg-black/30 rounded inline-block">{h.shares} UNITS</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-lg">{formatCurrency(h.shares * Number(h.price))}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1 opacity-70">
                    {formatCurrency(Number(h.price))} / UNIT
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioPhase({ state, mutate }: { state: any, mutate: any }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
      <Card className="border-primary/30 bg-card/60 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <CardHeader className="border-b border-border/30 bg-black/20 pb-6">
          <CardTitle className="text-3xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">MARKET EXCHANGE</CardTitle>
          <CardDescription className="text-lg font-mono tracking-widest text-primary/70">
            ALLOCATE CAPITAL | MAX 200 UNITS PER ASSET
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <motion.div variants={container} initial="hidden" animate="show" className="divide-y divide-border/30">
            {state.holdings.map((company: any) => (
              <motion.div variants={item} key={company.companyId}>
                <CompanyRow company={company} state={state} mutate={mutate} />
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CompanyRow({ company, state, mutate }: { company: any, state: any, mutate: any }) {
  const [loading, setLoading] = useState(false);
  const [tradeQty, setTradeQty] = useState(100);
  const maxAllowed = 200;
  
  const handleTrade = async (action: 'buy' | 'sell') => {
    if (!state.marketOpen) return toast.error("MARKET CLOSED", { description: "Trading is currently halted by the administrator." });
    if (tradeQty <= 0) return toast.error("INVALID QUANTITY");
    
    setLoading(true);
    try {
      const res = await fetch("/api/me/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: company.companyId, action, qty: tradeQty }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trade failed");
      toast.success(`ORDER EXECUTED: ${action.toUpperCase()} ${tradeQty} ${company.symbol}`, { className: "font-mono border-primary/50 bg-black/90 text-primary" });
      mutate();
    } catch (err: any) { toast.error("ORDER REJECTED", { description: err.message }); } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-between p-6 hover:bg-white/[0.02] transition-colors relative group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-primary/30 transition-colors" />
      <div className="flex-1 mb-4 xl:mb-0 w-full flex justify-between xl:justify-start xl:gap-12 items-center">
        <div>
          <h3 className="font-bold text-2xl tracking-wide flex items-center gap-3">
            {company.symbol}
            <span className="text-sm font-normal text-muted-foreground bg-black/40 px-2 py-1 rounded tracking-normal">
              {company.companyName}
            </span>
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary/50 animate-pulse" /> 
            POOL LIQUIDITY: <span className="text-primary font-bold">{company.poolRemaining} / {company.poolSize}</span>
          </p>
        </div>
        <div className="text-right xl:text-left">
          <p className="text-xs text-muted-foreground font-mono tracking-widest mb-1">MARKET PRICE</p>
          <p className="font-mono text-2xl font-black text-foreground drop-shadow-sm">{formatCurrency(Number(company.price))}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6 w-full xl:w-auto p-4 xl:p-0 bg-black/20 xl:bg-transparent rounded-lg border border-border/30 xl:border-none">
        <div className="flex flex-col items-center justify-center min-w-[80px] bg-black/40 px-4 py-2 rounded border border-border/50">
          <span className="text-[10px] text-muted-foreground font-mono tracking-widest mb-1">POSITION</span>
          <span className={`font-mono text-2xl font-black ${company.shares > 0 ? 'text-primary drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]' : 'text-muted-foreground opacity-50'}`}>
            {company.shares}
          </span>
        </div>
        
        <div className="flex items-center gap-3 flex-1 xl:flex-initial justify-end">
          <input
            type="number"
            min="1"
            max="200"
            value={tradeQty}
            onChange={(e) => setTradeQty(Number(e.target.value))}
            className="w-20 bg-black/40 border border-border rounded h-10 px-3 font-mono text-center outline-none focus:border-primary"
          />
          <Button variant="outline" size="sm" disabled={loading || company.shares < tradeQty} 
            onClick={() => handleTrade('sell')} 
            className="w-20 font-mono font-bold text-loss border-loss/30 hover:bg-loss/10 hover:border-loss h-10">
            SELL
          </Button>
          <Button variant="outline" size="sm" disabled={loading || company.shares + tradeQty > maxAllowed || company.poolRemaining < tradeQty || Number(state.cash) < Number(company.price) * tradeQty} 
            onClick={() => handleTrade('buy')} 
            className="w-20 font-mono font-bold text-profit border-profit/30 hover:bg-profit/10 hover:border-profit h-10">
            BUY
          </Button>
        </div>
      </div>
    </div>
  );
}

function EventPhase({ state, mutate }: { state: any, mutate: any }) {
  const { currentEvent, marketOpen } = state;
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  if (!currentEvent) return null;

  const [localLock, setLocalLock] = useState(false); const isLocked = !!currentEvent.currentChoice || localLock;
  const activeChoice = currentEvent.currentChoice || selectedOption;

  const handleConfirm = async () => {
    if (!selectedOption) return toast.error("NO OPTION SELECTED", { description: "Please select an option first." });
    if (!marketOpen) return toast.error("MARKET CLOSED", { description: "Cannot submit strategy right now." });
    setLoading(true);
    try {
      const res = await fetch("/api/me/choice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: currentEvent.eventId, option: selectedOption }) });
      if (!res.ok) throw new Error((await res.json()).error || "Submission failed");
      toast.success("STRATEGY LOCKED", { className: "font-mono border-orange-500/50 bg-black/90 text-orange-500" }); setLocalLock(true);
      mutate();
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const isGood = currentEvent.kind === 'GOOD';

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", damping: 25 }}>
      <Card className={`border-2 overflow-hidden shadow-2xl bg-card/80 backdrop-blur-md ${isGood ? 'border-profit/50 shadow-profit/10' : 'border-loss/50 shadow-loss/10'}`}>
        <div className={`h-2 w-full ${isGood ? 'bg-profit' : 'bg-loss'}`} />
        <CardHeader className="pb-8 border-b border-border/30 bg-black/20">
          <div className="flex justify-between items-start mb-6">
            <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest ${isGood ? 'bg-profit/20 text-profit border border-profit/50' : 'bg-loss/20 text-loss border border-loss/50'}`}>
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
                // Once locked, it's orange. Before lock, selection is highlighted lightly or orange too.
                const lockedClass = isLocked 
                  ? (isSelected ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-[1.02]' : 'opacity-50 border-border/50')
                  : (isSelected ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-[1.02]' : 'hover:border-orange-500/50 hover:bg-white/[0.02]');
                  
                return (
                  <Button
                    key={opt}
                    variant="outline"
                    className={`h-20 text-lg font-black tracking-wide border-2 transition-all duration-300 ${lockedClass}`}
                    onClick={() => !isLocked && setSelectedOption(opt)}
                    disabled={loading || !marketOpen || isLocked}
                  >
                    {isSelected && <CheckCircle className={`mr-3 ${isLocked ? 'text-orange-500' : 'text-orange-500 animate-bounce'}`} size={24} />}
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
                  {loading ? "LOCKING..." : "LOCK THE ANSWER"}
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
                    <span className="font-bold text-lg text-primary">{c.symbol}</span>
                    <span className="text-muted-foreground text-sm font-mono">{c.sector}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RevealPhase({ state }: { state: any }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 text-center relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, ease: "linear", repeat: Infinity }} className="mb-12 relative">
        <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
        <Activity className="w-32 h-32 text-primary" />
      </motion.div>
      <h2 className="text-5xl font-black mb-6 tracking-tight drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]">RESOLVING MARKET IMPACT</h2>
      <p className="text-2xl text-muted-foreground font-mono tracking-widest animate-pulse">
        CALCULATING VALUATIONS...
      </p>
    </motion.div>
  );
}

function FinalDecisionPhase({ state, mutate }: { state: any, mutate: any }) {
  const [notes, setNotes] = useState(state.notes || { line1: "", line2: "", line3: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/me/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notes) });
      if (!res.ok) throw new Error((await res.json()).error || "Submission failed");
      toast.success("MANIFESTO SAVED");
      mutate();
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 20 }}>
      <Card className="border-primary/50 shadow-[0_0_30px_rgba(255,215,0,0.1)] bg-card/80 backdrop-blur-md">
        <CardHeader className="bg-gradient-to-b from-primary/10 to-transparent pb-8 border-b border-border/30">
          <CardTitle className="text-4xl font-black text-primary flex items-center gap-4">
            <Save size={36} /> EXECUTIVE SUMMARY
          </CardTitle>
          <CardDescription className="text-lg font-mono tracking-widest mt-4">
            DOCUMENT YOUR STRATEGIC RATIONALE BEFORE FINAL SETTLEMENT
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {[1, 2, 3].map((num) => (
              <div key={num} className="space-y-3 relative group">
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-0 bg-primary transition-all duration-300 group-focus-within:h-full group-focus-within:-top-0" />
                <Label className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
                  {num === 1 ? 'Primary Thesis' : num === 2 ? 'Adaptation Protocol' : 'Post-Mortem Analysis'}
                </Label>
                <Input 
                  value={(notes as any)[`line${num}`]} 
                  onChange={e => setNotes({...notes, [`line${num}`]: e.target.value})} 
                  placeholder="Enter transmission data..."
                  className="h-14 font-mono text-lg bg-black/40 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            ))}
            <Button type="submit" disabled={loading} className="w-full h-16 text-xl font-black tracking-widest mt-8 bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:scale-[1.01] transition-transform">
              SUBMIT FINAL DECLARATION
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EndPhase({ state }: { state: any }) {
  if (!state.report) return (
    <div className="flex justify-center items-center h-64">
      <p className="font-mono animate-pulse tracking-widest text-xl text-primary">GENERATING FINAL REPORT...</p>
    </div>
  );
  
  const report = state.report;
  
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
      <Card className="border-primary bg-black shadow-[0_0_50px_rgba(255,215,0,0.15)] overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent pointer-events-none" />
        <CardHeader className="text-center pt-16 pb-12">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, delay: 0.2 }} className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-primary/50">
            <TrendingUp size={48} className="text-primary" />
          </motion.div>
          <CardTitle className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 drop-shadow-sm mb-4 tracking-tighter">
            SIMULATION TERMINATED
          </CardTitle>
          <CardDescription className="text-2xl font-mono tracking-widest text-primary/80">
            FINAL PERFORMANCE AUDIT
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-12 px-8 md:px-16 pb-16 relative z-10">
          <div className="flex flex-col md:flex-row justify-around items-center p-8 bg-card/80 backdrop-blur-md rounded-2xl border border-primary/30 shadow-[inset_0_0_30px_rgba(255,215,0,0.05)]">
            <div className="text-center mb-8 md:mb-0">
              <p className="text-sm text-muted-foreground font-mono tracking-widest mb-2 opacity-80">SETTLED NET WORTH</p>
              <p className="text-5xl md:text-7xl font-black text-primary drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] font-mono">
                {formatCurrency(Number(report.netWorth))}
              </p>
            </div>
            <div className="hidden md:block w-[1px] h-24 bg-border/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-mono tracking-widest mb-2 opacity-80">REMAINING LIQUIDITY</p>
              <p className="text-3xl md:text-5xl font-black font-mono text-foreground">
                {formatCurrency(Number(report.cash))}
              </p>
            </div>
          </div>
          
          <div className="bg-black/40 p-8 rounded-2xl border border-border/50">
            <h3 className="text-xl font-bold mb-6 border-b border-border/50 pb-4 text-primary tracking-widest flex items-center gap-3">
              <Briefcase /> SETTLED PORTFOLIO
            </h3>
            <div className="space-y-3">
              {report.holdings.filter((h: any) => h.shares > 0).map((h: any, i: number) => (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + (i * 0.1) }} key={i} className="flex justify-between items-center p-4 bg-muted/10 rounded-xl hover:bg-muted/20 transition-colors border border-border/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-black/50 flex items-center justify-center font-bold text-sm border border-border/50">
                      {h.symbol}
                    </div>
                    <div>
                      <span className="font-bold text-lg block leading-none mb-1">{h.companyName}</span>
                      <span className="text-muted-foreground font-mono text-xs tracking-widest">{h.shares} UNITS</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-bold">{formatCurrency(h.value)}</div>
                    <div className="text-xs text-muted-foreground font-mono opacity-70">VALUATION</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

