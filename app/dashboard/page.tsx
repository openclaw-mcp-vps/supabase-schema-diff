import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Lock } from "lucide-react";

import { PaywallUnlockForm } from "@/components/paywall-unlock-form";
import { ProjectSelector } from "@/components/project-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCESS_COOKIE_NAME, verifyAccessCookieValue } from "@/lib/paywall";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const access = verifyAccessCookieValue(accessCookie);

  if (!access.valid) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-14 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Lock className="h-5 w-5 text-cyan-300" /> Dashboard Locked
            </CardTitle>
            <CardDescription>
              This tool is behind the paid plan. Complete Stripe checkout, then unlock with the same purchase email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild>
                <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}>Buy access ($12/month)</a>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" /> Return to landing page
                </Link>
              </Button>
            </div>
            <PaywallUnlockForm />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">supabase-schema-diff</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">Schema Risk Dashboard</h1>
          <p className="text-sm text-slate-400">
            Compare environments before merging migrations. Access granted for {access.email}.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/">Back to landing</Link>
        </Button>
      </header>

      <ProjectSelector />
    </main>
  );
}
