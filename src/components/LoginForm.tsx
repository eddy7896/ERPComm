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
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

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
      </div>
    </div>
  );
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
      </div>
    </motion.form>
  );
}
