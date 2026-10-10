"use client";

import useSWR from "swr";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Settings, Plus, FastForward, PlayCircle, PauseCircle, ChevronDown, ChevronRight, Activity, Crosshair, BarChart3, Clock, Zap, Check, Pencil, Trash2, Save, Building, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};


export default function AdminPage() {
  const { data: state, error, mutate, isLoading } = useSWR("/api/admin/state", fetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center font-mono text-primary">
        <motion.div animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex flex-col items-center gap-4">
          <Activity size={48} />
          <p>INITIALIZING ADMIN TERMINAL...</p>
        </motion.div>
      </div>
    );
  }
  
  if (error || !state || state.error || !state.game) {
    if (state?.error === 'Unauthorized') {
      if (typeof window !== 'undefined') window.location.href = '/login';
      return null;
    }
    return <div className="flex h-screen items-center justify-center font-mono text-destructive">{state?.error?.toUpperCase() || "ERROR LOADING DATA"}</div>;
  }

  const goodCount = state.events?.filter((e: any) => e.kind === 'GOOD').length || 3;
  const badCount = state.events?.filter((e: any) => e.kind === 'BAD').length || 3;

  function confirmPhaseAdvance(p: string) {
    let warningMsg = "";
    if (state.game.phase === "PORTFOLIO" && p !== "PORTFOLIO") {
      const teamsMissing = state.leaderboard.filter((t: any) => t.holdings.filter((h: any) => h.shares > 0).length < 3);
      if (teamsMissing.length > 0) {
        warningMsg = "WARNING: The following teams haven't invested in at least 3 companies:\n" + teamsMissing.map((t: any) => "- " + t.name).join("\n") + "\n\nIf you advance, these teams will lose points on their Risk Management Diversification score.\n\nAre you sure you want to advance to " + p + "?";
      }
    } else if ((state.game.phase.startsWith("GOOD_") || state.game.phase.startsWith("BAD_")) && p !== state.game.phase) {
      const curEvent = state.events?.find((e: any) => e.code === state.game.phase);
      if (curEvent) {
        const teamsMissing = state.leaderboard.filter((t: any) => !t.choices.some((c: any) => c.eventId === curEvent.id));
        if (teamsMissing.length > 0) {
          warningMsg = "WARNING: The following teams HAVEN'T made a choice for " + state.game.phase + ":\n" + teamsMissing.map((t: any) => "- " + t.name).join("\n") + "\n\nIf you advance, these teams will be automatically penalized with the WORST option possible for this round.\n\nAre you sure you want to advance to " + p + "?";
        }
      }
    }

    if (warningMsg) {
      if (confirm(warningMsg)) handleSetPhase(p, mutate);
    } else {
      if (confirm(`Force transition to ${p}?`)) handleSetPhase(p, mutate);
    }
  }

  const ALL_PHASES = ['PORTFOLIO'];
  for (let i = 1; i <= goodCount; i++) ALL_PHASES.push(`GOOD_${i}`);
  ALL_PHASES.push('REVEAL_GOOD');
  for (let i = 1; i <= badCount; i++) ALL_PHASES.push(`BAD_${i}`);
  ALL_PHASES.push('REVEAL_BAD', 'FINAL_DECISION', 'END');

  const currentPhaseIdx = ALL_PHASES.indexOf(state.game.phase);

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 text-foreground pb-24">
      
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-black mb-2 flex items-center gap-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">
            <Settings className="text-primary" size={40} /> Admin Command Center
          </h1>
          <p className="text-muted-foreground font-mono text-lg">System controls, team management, and global oversight.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" size="lg" onClick={() => {
            if(prompt("Type RESET to delete all trades, portfolios, and reset the game back to 10 Lakh starting cash:") === 'RESET') {
              fetch('/api/admin/reset', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: 'RESET ROUND' })
              }).then(() => { window.location.reload(); });
            }
          }} className="font-mono border-destructive text-destructive hover:bg-destructive hover:text-white">
            <Settings size={16} className="mr-2" /> FACTORY RESET
          </Button>
          <Button variant="outline" size="lg" onClick={() => mutate()} className="font-mono border-primary/50 text-primary hover:bg-primary/20 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
            <Activity size={16} className="mr-2" /> FORCE SYNC
          </Button>
        </div>
      </motion.div>

      {/* Main Grid container (Masonry style, allows natural flow) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="space-y-8">
          
          {/* Phase & Market Box */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="border border-border/50 bg-card/40 backdrop-blur-md p-8 rounded-2xl shadow-2xl"
          >
            <h3 className="text-lg font-bold tracking-widest flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
              <Zap size={20} className="text-primary" /> PHASE & MARKET CONTROL
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phase Control Box */}
              <div className="border border-border/30 p-5 rounded-xl bg-black/40">
                <h4 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">CURRENT PHASE</h4>
                <p className="text-2xl font-black text-primary tracking-wide mb-4">{state.game.phase}</p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {ALL_PHASES.map((p, idx) => {
                    const isCurrent = state.game.phase === p;
                    const isCompleted = idx < currentPhaseIdx;
                    return (
                      <Button 
                        key={p} 
                        variant={isCurrent ? "default" : "outline"} 
                        onClick={() => confirmPhaseAdvance(p)} 
                        className={`w-full justify-start text-sm font-bold transition-all duration-300 ${
                          isCurrent ? 'bg-primary text-black shadow-lg' : 
                          isCompleted ? 'bg-blue-900/30 text-blue-400 border-blue-800/50 hover:bg-blue-800/50' : 
                          'hover:border-primary/50 text-muted-foreground hover:text-white'
                        }`}
                      >
                        {isCompleted && <Check size={14} className="mr-2" />}
                        {isCurrent && <PlayCircle size={14} className="mr-2" />}
                        {p}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Market Status Box */}
              <div className="border border-border/30 p-5 rounded-xl bg-black/40 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">MARKET STATUS</h4>
                  <div className={`p-6 rounded-xl flex flex-col items-center justify-center text-center mb-6 border ${state.game.marketOpen ? 'bg-profit/10 border-profit/50 text-profit' : 'bg-loss/10 border-loss/50 text-loss'}`}>
                    <span className="text-sm font-mono opacity-80 mb-1">TRADING IS</span>
                    <span className="text-3xl font-black tracking-widest">{state.game.marketOpen ? 'OPEN' : 'CLOSED'}</span>
                  </div>
                </div>
                <Button variant={state.game.marketOpen ? "destructive" : "default"} className="w-full font-bold h-12" onClick={() => handleToggleMarket(!state.game.marketOpen, mutate)}>
                  {state.game.marketOpen ? 'HALT TRADING' : 'RESUME TRADING'}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Editors Box (Companies and Events) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="border border-border/50 bg-card/40 backdrop-blur-md p-8 rounded-2xl shadow-2xl"
          >
            <h3 className="text-lg font-bold tracking-widest flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
              <Settings size={20} className="text-primary" /> GAME CONFIGURATION (EDITORS)
            </h3>
            
            <div className="space-y-8">
              <div className="border border-border/30 rounded-xl p-4 bg-black/20">
                <h4 className="text-sm font-bold tracking-widest text-primary mb-4">COMPANIES EDITOR</h4>
                {state.companies && <CompaniesEditor companies={state.companies} mutate={mutate} />}
              </div>
              
              <div className="border border-border/30 rounded-xl p-4 bg-black/20">
                <h4 className="text-sm font-bold tracking-widest text-primary mb-4">EVENTS EDITOR</h4>
                {state.events && <EventsEditor events={state.events} mutate={mutate} />}
              </div>
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          
          {/* Leaderboard Box */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="border border-border/50 bg-card/40 backdrop-blur-md p-8 rounded-2xl shadow-2xl"
          >
            <h3 className="text-lg font-bold tracking-widest flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
              <Users size={20} className="text-primary" /> GLOBAL LEADERBOARD
            </h3>
            <div className="bg-black/20 rounded-xl border border-border/30 p-2">
              {state.game.phase === 'END' ? (
                <EndPhaseLeaderboard scores={state.scores} leaderboard={state.leaderboard} />
              ) : (
                <LiveLeaderboard scores={state.scores} leaderboard={state.leaderboard} events={state.events} gamePhase={state.game.phase} mutate={mutate} />
              )}
            </div>
          </motion.div>

          {/* Team Management Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="border border-border/50 bg-card/40 backdrop-blur-md p-8 rounded-2xl shadow-2xl"
          >
            <h3 className="text-lg font-bold tracking-widest flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
              <Plus size={20} className="text-primary" /> REGISTER NEW TEAM
            </h3>
            <div className="bg-black/40 border border-border/30 p-6 rounded-xl">
              <AddTeamForm mutate={mutate} />
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

async function handleSetPhase(targetPhase: string, mutate: any) {
  try {
    const res = await fetch("/api/admin/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetPhase, force: true }) });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to advance phase");
    toast.success(`Phase set to ${targetPhase}`);
    mutate();
  } catch (e: any) { toast.error(e.message); }
}

async function handleToggleMarket(open: boolean, mutate: any) {
  try {
    const res = await fetch("/api/admin/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ open }) });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to toggle market");
    toast.success(`Market ${open ? 'opened' : 'closed'}`);
    mutate();
  } catch (e: any) { toast.error(e.message); }
}

function AddTeamForm({ mutate }: { mutate: any }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username, password }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add team");
      toast.success("Team added");
      setName(""); setUsername(""); setPassword("");
      mutate();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-black/20 rounded-lg border border-border/50">
      <Input placeholder="Syndicate Name" value={name} onChange={e => setName(e.target.value)} required className="bg-background/50" />
      <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required className="bg-background/50" />
      <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-background/50" />
      <Button type="submit" disabled={loading} className="w-full mt-2 font-bold bg-primary/20 text-primary hover:bg-primary hover:text-black">
        <Plus size={16} className="mr-2" /> REGISTER TEAM
      </Button>
    </form>
  );
}

function LiveLeaderboard({ leaderboard, scores, events, gamePhase, mutate }: { leaderboard: any[], scores: any[], events: any[], gamePhase: string, mutate: any }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {leaderboard.map((team, index) => (
        <motion.div key={team.id} variants={item}>
          <Card className={`border-border/40 backdrop-blur-sm bg-card/60 overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(255,215,0,0.15)] ${expanded === team.id ? 'border-primary/50 shadow-[0_0_25px_rgba(255,215,0,0.1)] ring-1 ring-primary/20' : ''}`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer relative z-10"
              onClick={() => setExpanded(expanded === team.id ? null : team.id)}
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center shadow-inner">
                  <span className="text-xl font-black text-primary">{team.rank}</span>
                </div>
                <div>
                  <h3 className="font-bold text-2xl tracking-wide">{team.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="font-mono bg-black/30 px-2 py-0.5 rounded text-xs">@{team.username}</span>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      if(confirm(`WARNING: Completely delete team ${team.name} and ALL their trades?`)) {
                        fetch(`/api/admin/teams/${team.id}`, { method: 'DELETE' }).then(res => {
                          if (!res.ok) throw new Error("Delete failed");
                          mutate(); // Refresh the list
                        }).catch(err => toast.error("Delete failed"));
                      }
                    }} className="h-6 text-xs text-loss hover:text-loss hover:bg-loss/10">DELETE TEAM</Button>
                  </div>
                </div>
              </div>
              
              
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

                  <p className="text-xs text-muted-foreground font-mono tracking-widest mb-1 opacity-70">CURRENT NET WORTH</p>
                  <p className="font-black font-mono text-primary text-3xl tracking-tight drop-shadow-md">
                    {formatCurrency(Number(team.netWorth))}
                  </p>
                </div>
                <div className={`p-2 rounded-full bg-black/20 border border-border transition-transform duration-300 ${expanded === team.id ? 'rotate-180 bg-primary/20 border-primary/30 text-primary' : ''}`}>
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>
            
            <AnimatePresence>
              {expanded === team.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: "auto", opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="border-t border-primary/20 bg-black/60 relative z-0"
                >
                  
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

                    <div className="space-y-4">
                      <h4 className="text-primary font-bold text-sm tracking-widest flex items-center gap-2 border-b border-border/50 pb-2">
                        <BarChart3 size={16} /> ASSETS BREAKDOWN
                      </h4>
                      <div className="p-4 bg-muted/10 rounded-lg border border-border/30 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-mono">Available Cash</span>
                          <span className="font-mono font-bold text-lg">{formatCurrency(Number(team.cash))}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-border/30 pt-3">
                          <span className="text-muted-foreground font-mono">Total Holdings Value</span>
                          <span className="font-mono font-bold text-lg">
                            {formatCurrency(team.holdings.reduce((sum: number, h: any) => sum + Number(h.value), 0))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-primary/30 pt-3 text-primary">
                          <span className="font-mono tracking-widest">NET WORTH</span>
                          <span className="font-mono font-black text-xl">{formatCurrency(Number(team.netWorth))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Initial Portfolio vs Current */}
                    <div className="space-y-4 xl:col-span-2">
                      <h4 className="text-primary font-bold text-sm tracking-widest flex items-center gap-2 border-b border-border/50 pb-2">
                        <Crosshair size={16} /> PORTFOLIO EVOLUTION
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/10 border border-border/30 rounded-lg overflow-hidden">
                          <div className="bg-black/40 p-2 text-xs font-mono text-center border-b border-border/30 text-muted-foreground">STARTING POSITION</div>
                          <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                            {team.initialPortfolio && team.initialPortfolio.length > 0 ? team.initialPortfolio.filter((h: any) => h.shares > 0).map((h: any) => (
                              <div key={h.companyId} className="flex justify-between items-center text-sm">
                                <span className="font-bold">{h.symbol}</span>
                                <span className="font-mono text-muted-foreground">{h.shares} units</span>
                              </div>
                            )) : <p className="text-xs text-center text-muted-foreground p-4">No initial trades.</p>}
                          </div>
                        </div>
                        
                        <div className="bg-muted/10 border border-border/30 rounded-lg overflow-hidden">
                          <div className="bg-black/40 p-2 text-xs font-mono text-center border-b border-border/30 text-primary">CURRENT POSITION</div>
                          <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                            {team.holdings.filter((h: any) => h.shares > 0).map((h: any) => (
                              <div key={h.companyId} className="flex justify-between items-center text-sm">
                                <span className="font-bold">{h.symbol}</span>
                                <div className="text-right flex flex-col">
                                  <span className="font-mono">{h.shares} units</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{formatCurrency(Number(h.price))}/unit</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Event Choices */}
                    <div className="space-y-4 xl:col-span-3">
                      <h4 className="text-primary font-bold text-sm tracking-widest flex items-center gap-2 border-b border-border/50 pb-2">
                        <Activity size={16} /> STRATEGIC DECISIONS
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {events.map(ev => {
                          const choice = team.choices.find((c: any) => c.eventId === ev.id);
                          const result = team.eventResults.find((r: any) => r.eventId === ev.id);
                          
                          if (!choice && ev.orderIndex > events.findIndex((e: any) => e.code === gamePhase)) {
                            return null; // Future event
                          }

                          const options = ev.kind === 'GOOD' ? ['AGGRESSIVE', 'MODERATE', 'PASS'] : ['HOLD', 'SELL_HALF', 'EXIT'];
                          
                          return (
                            <div key={ev.id} className="bg-muted/10 border border-border/30 rounded-lg p-4 flex flex-col relative overflow-hidden group">
                              <div className={`absolute top-0 right-0 w-2 h-full ${ev.kind === 'GOOD' ? 'bg-profit/50' : 'bg-loss/50'}`} />
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <p className="text-xs font-mono text-muted-foreground">{ev.code} | {ev.kind}</p>
                                  <p className="font-bold text-sm line-clamp-1">{ev.title}</p>
                                </div>
                              </div>
                              
                              <div className="flex gap-1 mt-auto">
                                {options.map(opt => {
                                  const isSelected = choice?.option === opt;
                                  return (
                                    <div key={opt} className={`flex-1 text-center py-1.5 text-[10px] font-mono rounded ${isSelected ? 'bg-primary text-black font-bold shadow-[0_0_10px_rgba(255,215,0,0.3)] scale-105 z-10' : 'bg-black/40 text-muted-foreground opacity-50'}`}>
                                      {opt.replace("_", " ")}
                                    </div>
                                  )
                                })}
                              </div>
                              {result && (
                                <div className="mt-3 text-xs text-right font-mono border-t border-border/30 pt-2">
                                  NW Delta: <span className={Number(result.netWorthDelta) >= 0 ? 'text-profit' : 'text-loss'}>{Number(result.netWorthDelta) >= 0 ? '+' : ''}{formatCurrency(Number(result.netWorthDelta))}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

function EndPhaseLeaderboard({ leaderboard, scores }: { leaderboard: any[], scores: any[] }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
      <div className="text-center p-12 bg-card border border-primary/50 shadow-[0_0_40px_rgba(255,215,0,0.1)] rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"></div>
        <h2 className="text-6xl font-black text-primary mb-4 drop-shadow-lg">SIMULATION CONCLUDED</h2>
        <p className="text-xl text-muted-foreground font-mono max-w-2xl mx-auto">The markets have closed. All final positions and decisions have been settled. Review the ultimate standings below.</p>
      </div>

      <div className="grid gap-4">
        {leaderboard.map((team, index) => (
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            key={team.id}
          >
            <Card className={`border-border overflow-hidden flex items-center p-6 ${index === 0 ? 'bg-gradient-to-r from-primary/20 to-transparent border-primary/50 ring-1 ring-primary/30' : 'bg-card/50'}`}>
              <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-black/30 rounded-full border border-primary/20 mr-6">
                {index === 0 ? <span className="text-4xl">👑</span> : <span className="text-2xl font-black text-primary">{team.rank}</span>}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{team.name}</h3>
                <p className="text-sm text-muted-foreground font-mono">@{team.username}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-muted-foreground mb-1">FINAL VALUATION</p>
                <p className={`text-4xl font-black font-mono ${index === 0 ? 'text-primary drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'text-foreground'}`}>
                  {formatCurrency(Number(team.netWorth))}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CompaniesEditor({ companies, mutate }: { companies: any[], mutate: any }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({ name: c.name, symbol: c.symbol, sector: c.sector, basePrice: c.basePrice, poolSize: c.poolSize });
  };

  const handleSave = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          symbol: formData.symbol,
          sector: formData.sector,
          basePrice: Number(formData.basePrice),
          poolSize: Number(formData.poolSize),
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Company updated");
      setEditingId(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this company? This may fail if it's referenced by trades/events.")) return;
    try {
      const res = await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Company deleted");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {companies.map((c: any) => (
        <div key={c.id} className="p-4 bg-card/60 border border-border/50 rounded-lg flex flex-col md:flex-row items-center gap-4">
          {editingId === c.id ? (
            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 w-full">
              <Input value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} placeholder="Symbol" />
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Name" />
              <Input value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} placeholder="Sector" />
              <Input type="number" value={formData.basePrice} onChange={e => setFormData({...formData, basePrice: e.target.value})} placeholder="Base Price" />
              <Input type="number" value={formData.poolSize} onChange={e => setFormData({...formData, poolSize: e.target.value})} placeholder="Total Shares" title="Total Shares (Pool Size)" />
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 w-full items-center">
              <span className="font-bold text-primary">{c.symbol}</span>
              <span className="font-mono text-sm">{c.name}</span>
              <span className="text-muted-foreground text-xs">{c.sector}</span>
              <span className="font-mono">{formatCurrency(Number(c.basePrice))}</span>
              <span className="font-mono text-xs text-muted-foreground">Shares: {c.poolSize}</span>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {editingId === c.id ? (
              <>
                <Button variant="default" size="sm" onClick={() => handleSave(c.id)}><Save size={14} className="mr-2"/> Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => handleEdit(c)}><Pencil size={14} /></Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsEditor({ events, mutate }: { events: any[], mutate: any }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const handleEdit = (ev: any) => {
    setEditingId(ev.id);
    setFormData({
      title: ev.title,
      questionText: ev.questionText,
      companies: ev.eventCompanies.map((ec: any) => ({
        companyId: ec.companyId,
        symbol: ec.company.symbol,
        aggressiveMove: Number(ec.aggressiveMove),
        moderateMove: Number(ec.moderateMove),
        holdDrop: Number(ec.holdDrop),
      }))
    });
  };

  const handleSave = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          questionText: formData.questionText,
          companies: formData.companies.map((c: any) => ({
            companyId: c.companyId,
            aggressiveMove: Number(c.aggressiveMove),
            moderateMove: Number(c.moderateMove),
            holdDrop: Number(c.holdDrop),
          }))
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Event updated");
      setEditingId(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddEvent = async (kind: string) => {
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`${kind} Event created`);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event? This will also remove any choices teams made for it!")) return;
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Event deleted");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="outline" className="w-full font-bold text-profit border-profit/50 hover:bg-profit/10" onClick={() => handleAddEvent('GOOD')}>
          <Plus size={16} className="mr-2" /> ADD GOOD EVENT
        </Button>
        <Button size="sm" variant="outline" className="w-full font-bold text-loss border-loss/50 hover:bg-loss/10" onClick={() => handleAddEvent('BAD')}>
          <Plus size={16} className="mr-2" /> ADD BAD EVENT
        </Button>
      </div>
      {events.map((ev: any) => (
        <div key={ev.id} className="p-4 bg-card/60 border border-border/50 rounded-lg flex flex-col gap-4">
          {editingId === ev.id ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Event Title" className="font-bold" />
                <textarea 
                  className="w-full bg-background border border-border rounded p-2 text-sm font-mono h-24"
                  value={formData.questionText} 
                  onChange={e => setFormData({...formData, questionText: e.target.value})}
                  placeholder="Event Description / Question"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">AFFECTED COMPANIES (Impact %)</p>
                {formData.companies.map((c: any, i: number) => (
                  <div key={c.companyId} className="grid grid-cols-4 gap-2 items-center bg-black/20 p-2 rounded">
                    <span className="font-bold text-primary">{c.symbol}</span>
                    <div>
                      <span className="text-[10px] block text-muted-foreground">Aggressive</span>
                      <Input type="number" step="0.1" value={c.aggressiveMove} onChange={e => {
                        const newCos = [...formData.companies];
                        newCos[i].aggressiveMove = e.target.value;
                        setFormData({...formData, companies: newCos});
                      }} />
                    </div>
                    <div>
                      <span className="text-[10px] block text-muted-foreground">Moderate</span>
                      <Input type="number" step="0.1" value={c.moderateMove} onChange={e => {
                        const newCos = [...formData.companies];
                        newCos[i].moderateMove = e.target.value;
                        setFormData({...formData, companies: newCos});
                      }} />
                    </div>
                    <div>
                      <span className="text-[10px] block text-muted-foreground">Hold Drop</span>
                      <Input type="number" step="0.1" value={c.holdDrop} onChange={e => {
                        const newCos = [...formData.companies];
                        newCos[i].holdDrop = e.target.value;
                        setFormData({...formData, companies: newCos});
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button variant="default" onClick={() => handleSave(ev.id)}><Save size={14} className="mr-2"/> Save Event</Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.kind === 'GOOD' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}`}>
                    {ev.code}
                  </span>
                  <span className="font-bold">{ev.title}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono line-clamp-2 max-w-2xl">{ev.questionText}</p>
                
                {ev.eventCompanies && ev.eventCompanies.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {ev.eventCompanies.map((ec: any) => (
                      <span key={ec.companyId} className="text-[10px] bg-black/40 px-2 py-1 rounded border border-border/50 text-muted-foreground">
                        <strong className="text-primary">{ec.company.symbol}</strong> A:{ec.aggressiveMove}% M:{ec.moderateMove}% H:{ec.holdDrop}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(ev)}><Pencil size={14} className="mr-2"/> Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(ev.id)}><Trash2 size={14} className="mr-2"/> Delete</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
