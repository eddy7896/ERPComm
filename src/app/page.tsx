"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Shield, LayoutDashboard, Globe, Lock } from "lucide-react";
import { LoginFormSkeleton } from "@/components/LoginForm";

const LoginForm = dynamic(() => import("@/components/LoginForm"), {
  ssr: false,
  loading: () => <LoginFormSkeleton />,
});

export default function Home() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950 font-sans selection:bg-zinc-100 dark:selection:bg-zinc-800">
      {/* Left side: Content area */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-zinc-900 dark:bg-white p-2 rounded-lg">
              <LayoutDashboard className="h-6 w-6 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">EnterpriseChat</span>
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Welcome back
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please enter your credentials to access your workspace.
            </p>
          </div>

          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>

          <div className="mt-8 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Demo Credentials</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400">Email:</span>
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-900 dark:text-zinc-300">user1@enterprise.com</code>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Password:</span>
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-900 dark:text-zinc-300">password123</code>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-500 text-center uppercase tracking-wider">
              Note: use any user1-25@enterprise.com with same password
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-900">
            <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Enterprise Security</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                <span>SSO Ready</span>
              </div>
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>Global Compliance</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right side: Hero/Visual area */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-50 dark:bg-zinc-900 items-center justify-center">
        {/* Subtle geometric pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 max-w-lg px-8 text-center"
        >
          <div className="mb-6 inline-flex p-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-xl border border-zinc-100 dark:border-zinc-700">
            <LayoutDashboard className="h-12 w-12 text-zinc-900 dark:text-white" />
          </div>
          <h2 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 leading-tight">
            Connect your team in one secure platform.
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
            The all-in-one workspace for enterprise collaboration, real-time messaging, and project management.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Uptime", value: "99.9%" },
              { label: "Active Users", value: "2M+" }
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute -bottom-24 -right-24 h-96 w-96 bg-zinc-200/50 dark:bg-zinc-800/50 blur-3xl rounded-full" />
        <div className="absolute -top-24 -left-24 h-96 w-96 bg-zinc-200/50 dark:bg-zinc-800/50 blur-3xl rounded-full" />
      </div>
    </div>
  );
}
