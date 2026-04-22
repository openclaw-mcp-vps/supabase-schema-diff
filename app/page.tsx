import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldAlert, Sparkles, Zap } from "lucide-react";

import { PaywallUnlockForm } from "@/components/paywall-unlock-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ACCESS_COOKIE_NAME, verifyAccessCookieValue } from "@/lib/paywall";

const faqItems = [
  {
    question: "What schema changes are marked as breaking?",
    answer:
      "Dropped tables, removed columns, NOT NULL tightenings, unsafe type mutations, removed/changed RLS policies, and critical index removals are flagged as breaking so they are obvious before rollout."
  },
  {
    question: "How do you connect to Supabase projects?",
    answer:
      "You provide each project URL and service role key in the dashboard, then the app reads metadata from Supabase pg-meta APIs for public/auth/storage schemas."
  },
  {
    question: "How does access unlocking work after payment?",
    answer:
      "Stripe webhook events record your purchase email. Enter the same email in Unlock Access and we issue an HTTP-only cookie that opens the dashboard."
  },
  {
    question: "Can I run this in CI before migrations ship?",
    answer:
      "Yes. The API returns a structured diff payload and unified diff text so you can fail deployments when breaking changes appear."
  }
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const access = verifyAccessCookieValue(accessCookie);

  return (
    <main className="pb-20">
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">supabase-schema-diff</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-4xl">
                Visual diff for Supabase schema drift between staging and production
              </h1>
              <p className="mt-3 max-w-3xl text-base text-slate-300 sm:text-lg">
                Catch breaking migrations before they hit customers. Compare tables, columns, indexes, and RLS policies
                in minutes instead of shipping blind and hoping rollbacks save you.
              </p>
            </div>
            {access.valid ? (
              <Button asChild>
                <Link href="/dashboard">Open Dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}>Start for $12/month</a>
              </Button>
            )}
          </div>
        </header>
      </section>

      <section className="mx-auto mt-8 grid max-w-6xl gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              The Problem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300">
              Supabase teams often run migrations in staging and assume production matches. Drift builds silently, and the
              first signal is broken APIs after deploy.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-4 w-4 text-red-300" />
              What Breaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300">
              Dropped columns, tightened nullability, changed RLS policies, and index mutations can fail reads, writes,
              and permissions instantly.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              The Fix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300">
              Run a visual diff before promoting migrations. Ship with confidence because you know exactly what changed
              and why it is risky or safe.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <Badge variant="info" className="w-fit gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Built for founders and small teams
            </Badge>
            <CardTitle className="mt-2 text-2xl">What you get inside the dashboard</CardTitle>
            <CardDescription className="max-w-3xl">
              The tool compares Supabase environments and labels each change with impact and recommended migration order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Schema-level diff coverage: new tables, dropped columns, index updates, policy changes",
                "Breaking vs review vs safe risk labels, including mitigation guidance",
                "Normalized JSON snapshots and unified diff output for CI gates",
                "Cookie-based paywall unlock after Stripe Payment Link checkout"
              ].map((item) => (
                <div key={item} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Pricing</CardTitle>
              <CardDescription>Simple pricing for teams that want safer migrations without enterprise overhead.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-4">
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-200">Starter</p>
                <p className="mt-1 text-3xl font-semibold text-white">$12/month</p>
                <p className="mt-2 text-sm text-cyan-100">
                  Unlimited schema diff runs, staging-vs-prod checks, and webhook-backed paywall access.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}>Buy with Stripe Checkout</a>
                </Button>
                {access.valid ? (
                  <Button variant="secondary" asChild>
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                ) : (
                  <Button variant="secondary" asChild>
                    <Link href="/dashboard">See locked dashboard</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LockKeyhole className="h-4 w-4 text-cyan-300" /> Unlock purchased access
              </CardTitle>
              <CardDescription>
                Complete Stripe checkout first, then unlock with the purchase email to set your secure access cookie.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaywallUnlockForm />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">FAQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqItems.map((item, index) => (
              <div key={item.question} className="space-y-2">
                <h3 className="text-base font-semibold text-slate-100">{item.question}</h3>
                <p className="text-sm text-slate-300">{item.answer}</p>
                {index < faqItems.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <footer className="mx-auto mt-12 max-w-6xl px-4 text-sm text-slate-500 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
          <p>supabase-schema-diff: reduce migration risk before production deploys.</p>
          <p className="flex items-center gap-1 text-slate-400">
            <Zap className="h-3.5 w-3.5 text-cyan-300" /> Built for small teams shipping fast.
          </p>
        </div>
      </footer>
    </main>
  );
}
