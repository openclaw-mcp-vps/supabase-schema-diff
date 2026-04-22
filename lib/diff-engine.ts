import * as Diff2Html from "diff2html";

import type { ChangeSeverity, DiffItem, SchemaDiffResult, SchemaSnapshot, SchemaTable } from "@/types/schema";

const severityWeight: Record<ChangeSeverity, number> = {
  breaking: 0,
  warning: 1,
  safe: 2
};

function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, nested]) => [key, stableSortObject(nested)]));
  }

  return value;
}

function projectJson(snapshot: SchemaSnapshot) {
  return JSON.stringify(stableSortObject(snapshot.tables), null, 2);
}

function createUnifiedDiff(source: SchemaSnapshot, target: SchemaSnapshot) {
  const sourceJson = projectJson(source);
  const targetJson = projectJson(target);

  const sourceLines = sourceJson.split("\n");
  const targetLines = targetJson.split("\n");

  const removedLines = sourceLines.map((line) => `-${line}`).join("\n");
  const addedLines = targetLines.map((line) => `+${line}`).join("\n");

  return [
    `diff --git a/${source.projectRef}.json b/${target.projectRef}.json`,
    `--- a/${source.projectRef}.json`,
    `+++ b/${target.projectRef}.json`,
    `@@ -1,${sourceLines.length} +1,${targetLines.length} @@`,
    removedLines,
    addedLines,
    ""
  ].join("\n");
}

function classifyTypeChange(beforeType: string, afterType: string): ChangeSeverity {
  const before = beforeType.toLowerCase();
  const after = afterType.toLowerCase();

  if (before === after) {
    return "safe";
  }

  const wideningSafePairs = new Set([
    "smallint:int",
    "smallint:bigint",
    "integer:bigint",
    "int2:int4",
    "int2:int8",
    "int4:int8",
    "varchar:text",
    "character varying:text"
  ]);

  if (wideningSafePairs.has(`${before}:${after}`)) {
    return "warning";
  }

  return "breaking";
}

function compareTable(
  sourceTable: SchemaTable,
  targetTable: SchemaTable,
  pushes: (item: Omit<DiffItem, "id">) => void
) {
  const tableName = `${sourceTable.schema}.${sourceTable.name}`;

  if (sourceTable.rlsEnabled !== targetTable.rlsEnabled) {
    const turningOn = !sourceTable.rlsEnabled && targetTable.rlsEnabled;
    pushes({
      severity: turningOn ? "breaking" : "warning",
      resourceType: "rls",
      table: tableName,
      entity: "Row Level Security",
      summary: turningOn ? "RLS was enabled" : "RLS was disabled",
      before: sourceTable.rlsEnabled ? "enabled" : "disabled",
      after: targetTable.rlsEnabled ? "enabled" : "disabled",
      impact: turningOn
        ? "Queries that previously worked may start returning no rows until policies are updated."
        : "Data becomes more exposed if your API relies on RLS for tenant isolation.",
      recommendation: turningOn
        ? "Ship matching SELECT/INSERT/UPDATE/DELETE policies in the same migration."
        : "Confirm this was intentional and verify that sensitive tables remain protected."
    });
  }

  const sourceColumns = Object.keys(sourceTable.columns);
  const targetColumns = Object.keys(targetTable.columns);

  for (const columnName of sourceColumns) {
    if (!targetTable.columns[columnName]) {
      pushes({
        severity: "breaking",
        resourceType: "column",
        table: tableName,
        entity: columnName,
        summary: `Column ${columnName} was dropped`,
        before: sourceTable.columns[columnName].dataType,
        after: null,
        impact: "App queries and writes that reference this column will fail immediately.",
        recommendation: "Use a two-step migration: add replacement column, backfill, deploy app, then drop."
      });
      continue;
    }

    const beforeColumn = sourceTable.columns[columnName];
    const afterColumn = targetTable.columns[columnName];

    if (beforeColumn.dataType !== afterColumn.dataType) {
      const severity = classifyTypeChange(beforeColumn.dataType, afterColumn.dataType);
      pushes({
        severity,
        resourceType: "column",
        table: tableName,
        entity: columnName,
        summary: `Column type changed from ${beforeColumn.dataType} to ${afterColumn.dataType}`,
        before: beforeColumn.dataType,
        after: afterColumn.dataType,
        impact:
          severity === "breaking"
            ? "Casting failures and index invalidation are likely if existing values do not fit the new type."
            : "Type widening usually works, but adapters and generated types may need updates.",
        recommendation:
          severity === "breaking"
            ? "Run a dry migration with production-like data and explicitly cast in SQL before deploy."
            : "Regenerate API/client types and run integration tests against staging."
      });
    }

    if (beforeColumn.isNullable && !afterColumn.isNullable) {
      pushes({
        severity: "breaking",
        resourceType: "column",
        table: tableName,
        entity: columnName,
        summary: `Column ${columnName} became NOT NULL`,
        before: "nullable",
        after: "not null",
        impact: "Migration will fail if any existing rows contain null values.",
        recommendation: "Backfill null rows first, then add NOT NULL in a separate migration."
      });
    }

    if (!beforeColumn.isNullable && afterColumn.isNullable) {
      pushes({
        severity: "safe",
        resourceType: "column",
        table: tableName,
        entity: columnName,
        summary: `Column ${columnName} is now nullable`,
        before: "not null",
        after: "nullable",
        impact: "This is backward-compatible but can change assumptions in downstream analytics.",
        recommendation: "Audit code paths that assume non-null values."
      });
    }

    if (beforeColumn.defaultValue !== afterColumn.defaultValue) {
      pushes({
        severity: "warning",
        resourceType: "column",
        table: tableName,
        entity: columnName,
        summary: `Default value changed for ${columnName}`,
        before: beforeColumn.defaultValue,
        after: afterColumn.defaultValue,
        impact: "New records may carry different values than previous deployments expected.",
        recommendation: "Ensure your API and background jobs agree with the new default behavior."
      });
    }
  }

  for (const columnName of targetColumns) {
    if (!sourceTable.columns[columnName]) {
      const column = targetTable.columns[columnName];
      const safeAdd = column.isNullable || Boolean(column.defaultValue);

      pushes({
        severity: safeAdd ? "safe" : "breaking",
        resourceType: "column",
        table: tableName,
        entity: columnName,
        summary: `Column ${columnName} was added`,
        before: null,
        after: column.dataType,
        impact: safeAdd
          ? "This is usually backward-compatible for existing rows and writes."
          : "Adding a required column without default can fail inserts from older app versions.",
        recommendation: safeAdd
          ? "Roll out app reads/writes for the new column after migration."
          : "Add as nullable/default first, deploy application changes, then enforce NOT NULL."
      });
    }
  }

  const sourceIndexes = Object.keys(sourceTable.indexes);
  const targetIndexes = Object.keys(targetTable.indexes);

  for (const indexName of sourceIndexes) {
    if (!targetTable.indexes[indexName]) {
      const index = sourceTable.indexes[indexName];
      pushes({
        severity: index.isPrimary || index.isUnique ? "breaking" : "warning",
        resourceType: "index",
        table: tableName,
        entity: indexName,
        summary: `Index ${indexName} was dropped`,
        before: index.definition,
        after: null,
        impact:
          index.isPrimary || index.isUnique
            ? "Primary/unique behavior changed and app-level assumptions may break."
            : "Query performance can degrade significantly on large tables.",
        recommendation:
          index.isPrimary || index.isUnique
            ? "Confirm uniqueness and key constraints are preserved before deploying."
            : "Load-test the impacted query paths and add replacement indexes if needed."
      });
      continue;
    }

    const before = sourceTable.indexes[indexName];
    const after = targetTable.indexes[indexName];
    if (before.definition !== after.definition) {
      pushes({
        severity: before.isUnique && !after.isUnique ? "breaking" : "warning",
        resourceType: "index",
        table: tableName,
        entity: indexName,
        summary: `Index definition changed for ${indexName}`,
        before: before.definition,
        after: after.definition,
        impact: "Planner behavior and uniqueness guarantees may change across environments.",
        recommendation: "Run explain plans for hot queries and verify uniqueness behavior in staging."
      });
    }
  }

  for (const indexName of targetIndexes) {
    if (!sourceTable.indexes[indexName]) {
      const index = targetTable.indexes[indexName];
      pushes({
        severity: "safe",
        resourceType: "index",
        table: tableName,
        entity: indexName,
        summary: `Index ${indexName} was added`,
        before: null,
        after: index.definition,
        impact: "Read performance and uniqueness guarantees typically improve.",
        recommendation: "Monitor write amplification and vacuum pressure after rollout."
      });
    }
  }

  const sourcePolicies = Object.keys(sourceTable.policies);
  const targetPolicies = Object.keys(targetTable.policies);

  for (const policyName of sourcePolicies) {
    if (!targetTable.policies[policyName]) {
      pushes({
        severity: "breaking",
        resourceType: "policy",
        table: tableName,
        entity: policyName,
        summary: `Policy ${policyName} was removed`,
        before: sourceTable.policies[policyName].usingExpression,
        after: null,
        impact: "Requests that depended on this policy can start failing with permission errors.",
        recommendation: "Bundle policy changes with end-to-end auth tests for each role."
      });
      continue;
    }

    const before = sourceTable.policies[policyName];
    const after = targetTable.policies[policyName];

    const beforeSignature = JSON.stringify({
      action: before.action,
      roles: before.roles,
      usingExpression: before.usingExpression,
      checkExpression: before.checkExpression
    });

    const afterSignature = JSON.stringify({
      action: after.action,
      roles: after.roles,
      usingExpression: after.usingExpression,
      checkExpression: after.checkExpression
    });

    if (beforeSignature !== afterSignature) {
      pushes({
        severity: "breaking",
        resourceType: "policy",
        table: tableName,
        entity: policyName,
        summary: `Policy ${policyName} changed`,
        before: beforeSignature,
        after: afterSignature,
        impact: "Role-level access behavior can diverge sharply between staging and production.",
        recommendation: "Run a role matrix test suite before promoting this migration."
      });
    }
  }

  for (const policyName of targetPolicies) {
    if (!sourceTable.policies[policyName]) {
      pushes({
        severity: "warning",
        resourceType: "policy",
        table: tableName,
        entity: policyName,
        summary: `Policy ${policyName} was added`,
        before: null,
        after: targetTable.policies[policyName].usingExpression,
        impact: "New policies can intentionally tighten access but may block existing clients.",
        recommendation: "Test write and read paths for anon/authenticated/service roles."
      });
    }
  }
}

export function generateSchemaDiff(source: SchemaSnapshot, target: SchemaSnapshot): SchemaDiffResult {
  const changes: DiffItem[] = [];

  const pushWithId = (item: Omit<DiffItem, "id">) => {
    changes.push({
      id: `${item.resourceType}-${item.table}-${item.entity}-${changes.length + 1}`,
      ...item
    });
  };

  const sourceTables = Object.keys(source.tables);
  const targetTables = Object.keys(target.tables);

  for (const tableName of sourceTables) {
    if (!target.tables[tableName]) {
      pushWithId({
        severity: "breaking",
        resourceType: "table",
        table: tableName,
        entity: tableName,
        summary: `Table ${tableName} was dropped`,
        before: "present",
        after: null,
        impact: "Any query against this table will fail after migration.",
        recommendation: "Use a deprecation period and remove all app references before dropping."
      });
      continue;
    }

    compareTable(source.tables[tableName], target.tables[tableName], pushWithId);
  }

  for (const tableName of targetTables) {
    if (!source.tables[tableName]) {
      pushWithId({
        severity: "safe",
        resourceType: "table",
        table: tableName,
        entity: tableName,
        summary: `Table ${tableName} was added`,
        before: null,
        after: "present",
        impact: "New table introduction is generally backward-compatible for existing queries.",
        recommendation: "Review permissions and indexes before enabling in production traffic."
      });
    }
  }

  const sortedChanges = [...changes].sort((a, b) => {
    const severitySort = severityWeight[a.severity] - severityWeight[b.severity];
    if (severitySort !== 0) {
      return severitySort;
    }

    return a.table.localeCompare(b.table) || a.entity.localeCompare(b.entity);
  });

  if (sortedChanges.length === 0) {
    sortedChanges.push({
      id: "schema-clean",
      severity: "safe",
      resourceType: "table",
      table: "all",
      entity: "schema",
      summary: "No schema drift detected",
      before: null,
      after: null,
      impact: "Staging and production schemas match for tracked entities.",
      recommendation: "Safe to promote migrations from a structural perspective."
    });
  }

  const summary = {
    breaking: sortedChanges.filter((change) => change.severity === "breaking").length,
    warning: sortedChanges.filter((change) => change.severity === "warning").length,
    safe: sortedChanges.filter((change) => change.severity === "safe").length,
    total: sortedChanges.length
  };

  const unifiedDiff = createUnifiedDiff(source, target);
  const unifiedDiffHtml = Diff2Html.html(unifiedDiff, {
    drawFileList: false,
    matching: "lines",
    outputFormat: "side-by-side"
  });

  return {
    sourceProject: source.projectName,
    targetProject: target.projectName,
    generatedAt: new Date().toISOString(),
    summary,
    changes: sortedChanges,
    unifiedDiff,
    unifiedDiffHtml,
    sourceSnapshot: source,
    targetSnapshot: target
  };
}
