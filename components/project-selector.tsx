"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw, Server } from "lucide-react";

import { SchemaDiff } from "@/components/schema-diff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { SchemaDiffResult, SupabaseProjectInput } from "@/types/schema";

interface ProjectState extends SupabaseProjectInput {
  verified: boolean;
  lastCheckedAt: string | null;
}

const initialProject = (name: string): ProjectState => ({
  name,
  projectUrl: "",
  serviceRoleKey: "",
  verified: false,
  lastCheckedAt: null
});

export function ProjectSelector() {
  const [source, setSource] = useState<ProjectState>(initialProject("Staging"));
  const [target, setTarget] = useState<ProjectState>(initialProject("Production"));
  const [busyAction, setBusyAction] = useState<"none" | "source" | "target" | "diff">("none");
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<SchemaDiffResult | null>(null);

  const readyForDiff = useMemo(
    () =>
      Boolean(source.projectUrl && source.serviceRoleKey && target.projectUrl && target.serviceRoleKey) &&
      source.verified &&
      target.verified,
    [source, target]
  );

  function updateProject(type: "source" | "target", patch: Partial<ProjectState>) {
    if (type === "source") {
      setSource((current) => ({ ...current, ...patch, verified: false }));
      return;
    }

    setTarget((current) => ({ ...current, ...patch, verified: false }));
  }

  async function testConnection(type: "source" | "target") {
    setError(null);
    setBusyAction(type);

    const payload = type === "source" ? source : target;

    try {
      const response = await fetch("/api/supabase/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: payload.name,
          projectUrl: payload.projectUrl,
          serviceRoleKey: payload.serviceRoleKey
        })
      });

      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Connection failed");
      }

      if (type === "source") {
        setSource((current) => ({ ...current, verified: true, lastCheckedAt: new Date().toISOString() }));
      } else {
        setTarget((current) => ({ ...current, verified: true, lastCheckedAt: new Date().toISOString() }));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to connect");
    } finally {
      setBusyAction("none");
    }
  }

  async function runDiff() {
    setError(null);
    setBusyAction("diff");

    try {
      const response = await fetch("/api/supabase/schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: {
            name: source.name,
            projectUrl: source.projectUrl,
            serviceRoleKey: source.serviceRoleKey
          },
          target: {
            name: target.name,
            projectUrl: target.projectUrl,
            serviceRoleKey: target.serviceRoleKey
          }
        })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; diff?: SchemaDiffResult };

      if (!response.ok || !payload.ok || !payload.diff) {
        throw new Error(payload.error ?? "Could not compute diff");
      }

      setDiff(payload.diff);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to compute diff");
    } finally {
      setBusyAction("none");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Server className="h-5 w-5 text-cyan-300" />
            Configure Projects
          </CardTitle>
          <CardDescription>
            Provide each environment&apos;s project URL and service role key. Keys are used only for this request and are
            never written to the browser storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { id: "source" as const, project: source, label: "Staging" },
              { id: "target" as const, project: target, label: "Production" }
            ].map(({ id, project, label }) => (
              <div key={id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-100">{label}</h3>
                  {project.verified ? (
                    <Badge variant="safe" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning">Needs check</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`${id}-url`}>
                      Project URL
                    </label>
                    <Input
                      id={`${id}-url`}
                      value={project.projectUrl}
                      onChange={(event) => updateProject(id, { projectUrl: event.target.value })}
                      placeholder="https://your-project-ref.supabase.co"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`${id}-key`}>
                      Service role key
                    </label>
                    <Input
                      id={`${id}-key`}
                      type="password"
                      value={project.serviceRoleKey}
                      onChange={(event) => updateProject(id, { serviceRoleKey: event.target.value })}
                      placeholder="eyJhbGciOi..."
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={busyAction !== "none"}
                    onClick={() => testConnection(id)}
                  >
                    {busyAction === id ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Testing connection...
                      </>
                    ) : (
                      "Test connection"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-slate-400">
              Compare schemas across `public`, `auth`, and `storage` to catch drift before migrations hit production.
            </p>
            <Button onClick={runDiff} disabled={!readyForDiff || busyAction !== "none"}>
              {busyAction === "diff" ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  Computing diff...
                </>
              ) : (
                "Generate schema diff"
              )}
            </Button>
          </div>

          {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      {diff ? <SchemaDiff result={diff} /> : null}
    </div>
  );
}
