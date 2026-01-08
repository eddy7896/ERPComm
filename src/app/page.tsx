"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, Users, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      <header className="flex h-16 items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">EnterpriseChat</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative py-24 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl"
          >
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl mb-6">
              The communication platform for <span className="text-primary">enterprise teams.</span>
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed">
              Real-time messaging, channels, and role-based access control built for scale.
              Secure, fast, and designed for professional organizations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto px-8 text-lg h-14">
                  Start your workspace
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 text-lg h-14">
                  View Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        <section className="py-24 bg-zinc-50 dark:bg-zinc-900/50 px-6">
          <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center p-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Performance</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Instantly sync messages across all devices with our high-performance WebSocket architecture.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Role-based Access</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Granular permissions for Owners, Admins, and Members to keep your organization organized.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Enterprise Security</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                End-to-end data isolation and secure authentication methods to protect your company data.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-zinc-100 dark:border-zinc-800 text-center text-sm text-zinc-500">
        <p>&copy; 2024 EnterpriseChat Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
