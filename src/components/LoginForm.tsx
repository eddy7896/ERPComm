"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, LayoutDashboard, ArrowRight, Loader2, Code, Palette, Zap } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "admin@enterprise.com", role: "Lead", workspace: "Nexus Solutions", icon: Shield, color: "text-blue-500" },
  { email: "design@enterprise.com", role: "Director", workspace: "Design Studio", icon: Palette, color: "text-pink-500" },
  { email: "engineering@enterprise.com", role: "Head of Eng", workspace: "Tech Frontier", icon: Code, color: "text-emerald-500" },
  { email: "marketing@enterprise.com", role: "CMO", workspace: "Marketing Pulse", icon: Zap, color: "text-amber-500" },
  { email: "product@enterprise.com", role: "PM", workspace: "Multi-Team", icon: LayoutDashboard, color: "text-purple-500" },
];

export function LoginFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
      <div className="space-y-4 pt-2">
        <Skeleton className="h-11 w-full" />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-px flex-1" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    if (!authLoading && user) {
      router.push(redirect || "/workspaces");
    }
  }, [user, authLoading, router, redirect]);

  if (authLoading) {
    return <LoginFormSkeleton />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logged in successfully!");
      router.push(redirect || "/workspaces");
    }
    setLoading(false);
  };

  const autofillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleLogin} 
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </Label>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
          />
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <Button 
          type="submit" 
          className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign in to Workspace <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Quick Access</span>
            <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => autofillDemo(account.email)}
                className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-white transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900"
                title={account.role}
              >
                <account.icon className={`h-4 w-4 ${account.color} group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-medium text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white truncate w-full text-center">
                  {account.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.form>
  );
}
