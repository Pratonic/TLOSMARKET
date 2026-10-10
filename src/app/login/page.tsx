"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

const AnimatedTicker = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.15] pointer-events-none flex flex-col justify-around py-10 z-0">
      {[1, 2, 3, 4, 5].map((row) => (
        <motion.div
          key={row}
          className="flex whitespace-nowrap gap-12"
          animate={{ x: row % 2 === 0 ? [0, -2000] : [-2000, 0] }}
          transition={{ duration: 30 + row * 10, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 40 }).map((_, i) => {
            const isGreen = Math.random() > 0.4;
            const sym = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
            const val = (Math.random() * 1000).toFixed(2);
            const perc = (Math.random() * 5).toFixed(2);
            return (
              <div key={i} className={`flex items-center gap-3 font-mono text-2xl font-bold ${isGreen ? 'text-profit' : 'text-loss'}`}>
                <span className="text-white/50">{sym}</span>
                <span>{val}</span>
                <span>{isGreen ? '▲' : '▼'} {perc}%</span>
              </div>
            );
          })}
        </motion.div>
      ))}
    </div>
  );
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Login successful");
        router.push(data.redirect);
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-black">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <AnimatedTicker />
        <motion.div 
          className="absolute inset-[calc(-5%)] opacity-20 bg-[url('/stock_bg.jpg')] bg-cover mix-blend-screen"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div 
          className="absolute inset-0 opacity-80"
          animate={{
            background: `radial-gradient(800px circle at ${mousePos.x}% ${mousePos.y}%, rgba(34,197,94,0.3) 0%, rgba(234,179,8,0.1) 30%, transparent 70%)`
          }}
          transition={{ type: "tween", ease: "linear", duration: 0.1 }}
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30 mix-blend-overlay" />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="z-10 w-full max-w-md"
      >
        <Card className="w-full border-primary/20 bg-black/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-8">
            <motion.div 
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, type: "spring" }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary shadow-[0_0_30px_rgba(34,197,94,0.3)]"
            >
              <TrendingUp size={40} />
            </motion.div>
            <div>
              <CardTitle className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-green-400 to-yellow-500 tracking-tight">
                TLOS MARKET
              </CardTitle>
              <CardDescription className="mt-2 text-sm font-mono tracking-widest text-muted-foreground/80">
                SECURE TRADING TERMINAL
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-mono tracking-widest text-muted-foreground">IDENTIFIER</Label>
                <Input
                  id="username"
                  placeholder="admin or team1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="font-mono bg-black/50 border-border/50 h-12 text-lg focus-visible:ring-primary focus-visible:border-primary"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-mono tracking-widest text-muted-foreground">ACCESS CODE</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono bg-black/50 border-border/50 h-12 text-lg focus-visible:ring-primary focus-visible:border-primary"
                  required
                />
              </div>
              <Button type="submit" className="w-full font-bold h-12 text-lg tracking-wider shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all" disabled={isLoading}>
                {isLoading ? "AUTHENTICATING..." : "INITIALIZE LOGIN"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
