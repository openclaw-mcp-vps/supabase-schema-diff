"use client";

import { useMemo, useState } from "react";
import ReactDiffViewer from "react-diff-viewer";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChangeSeverity, DiffItem, SchemaDiffResult } from "@/types/schema";

const severityStyles: Record<ChangeSeverity, { label: string; badgeVariant: "destructive" | "warning" | "safe" }> = {
  breaking: { label: "Breaking", badgeVariant: "destructive" },
  warning: { label: "Review", badgeVariant: "warning" },
  safe: { label: "Safe", badgeVariant: "safe" }
};

function DiffRow({ change }: { change: DiffItem }) {
  const severity = severityStyles[change.severity];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-300">
          <p className="font-semibold text-slate-100">{change.summary}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {change.resourceType} | {change.table}
          </p>
        </div>
        <Badge variant={severity.badgeVariant}>{severity.label}</Badge>
      </div>
      <p className="mt-3 text-sm text-slate-300">Impact: {change.impact}</p>
      <p className="mt-2 text-sm text-cyan-100">Recommended action: {change.recommendation}</p>
      {(change.before || change.after) && (
        <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
          <div>
            <p className="mb-1 uppercase tracking-wide text-slate-500">Before</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2">{change.before ?? "n/a"}</pre>
          </div>
          <div>
            <p className="mb-1 uppercase tracking-wide text-slate-500">After</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2">{change.after ?? "n/a"}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

interface SchemaDiffProps {
  result: SchemaDiffResult;
}

export function SchemaDiff({ result }: SchemaDiffProps) {
  const [filter, setFilter] = useState<"all" | ChangeSeverity>("all");
  const [showRaw, setShowRaw] = useState(false);

  const filteredChanges = useMemo(() => {
    if (filter === "all") {
      return result.changes;
    }

    return result.changes.filter((change) => change.severity === filter);
  }, [filter, result.changes]);

  const sourceJson = useMemo(() => JSON.stringify(result.sourceSnapshot.tables, null, 2), [result.sourceSnapshot.tables]);
  const targetJson = useMemo(() => JSON.stringify(result.targetSnapshot.tables, null, 2), [result.targetSnapshot.tables]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Breaking Changes</CardDescription>
            <CardTitle className="text-2xl text-red-300">{result.summary.breaking}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Needs Review</CardDescription>
            <CardTitle className="text-2xl text-amber-200">{result.summary.warning}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Safe Changes</CardDescription>
            <CardTitle className="text-2xl text-emerald-200">{result.summary.safe}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filter === "all" ? "default" : "secondary"} size="sm" onClick={() => setFilter("all")}>
          All ({result.summary.total})
        </Button>
        <Button
          variant={filter === "breaking" ? "default" : "secondary"}
          size="sm"
          onClick={() => setFilter("breaking")}
        >
          Breaking ({result.summary.breaking})
        </Button>
        <Button variant={filter === "warning" ? "default" : "secondary"} size="sm" onClick={() => setFilter("warning")}>
          Review ({result.summary.warning})
        </Button>
        <Button variant={filter === "safe" ? "default" : "secondary"} size="sm" onClick={() => setFilter("safe")}>
          Safe ({result.summary.safe})
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowRaw((current) => !current)}>
          {showRaw ? "Hide Raw JSON Diff" : "Show Raw JSON Diff"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diff Findings</CardTitle>
          <CardDescription>
            Compared {result.sourceProject} against {result.targetProject} at {new Date(result.generatedAt).toLocaleString()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredChanges.map((change) => (
            <DiffRow key={change.id} change={change} />
          ))}
        </CardContent>
      </Card>

      {showRaw ? (
        <Card>
          <CardHeader>
            <CardTitle>Raw Schema JSON Diff</CardTitle>
            <CardDescription>Line-level comparison of the normalized schema snapshot payloads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-hidden">
            <div className="overflow-x-auto rounded border border-slate-800">
              <ReactDiffViewer
                oldValue={sourceJson}
                newValue={targetJson}
                splitView
                showDiffOnly={false}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: "#0b1220",
                      diffViewerColor: "#d5dceb",
                      addedBackground: "#063b2f",
                      removedBackground: "#4a1f22",
                      wordAddedBackground: "#0f766e",
                      wordRemovedBackground: "#be123c",
                      addedGutterBackground: "#0b2b24",
                      removedGutterBackground: "#3f1b1f"
                    }
                  }
                }}
              />
            </div>
            <details className="rounded border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
              <summary className="cursor-pointer font-medium text-slate-100">Unified Diff (for pipelines)</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{result.unifiedDiff}</pre>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
