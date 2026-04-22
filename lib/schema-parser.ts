import type { SchemaColumn, SchemaIndex, SchemaPolicy, SchemaSnapshot, SchemaTable, SupabaseProjectInput } from "@/types/schema";

class SchemaFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaFetchError";
  }
}

interface RawTable {
  name?: string;
  schema?: string;
  rls_enabled?: boolean;
  is_rls_enabled?: boolean;
}

interface RawColumn {
  table?: string;
  table_name?: string;
  schema?: string;
  table_schema?: string;
  name?: string;
  data_type?: string;
  format?: string;
  is_nullable?: boolean | string;
  default_value?: string | null;
}

interface RawIndex {
  table?: string;
  schema?: string;
  name?: string;
  is_unique?: boolean;
  is_primary?: boolean;
  definition?: string;
  indexdef?: string;
}

interface RawPolicy {
  table?: string;
  schema?: string;
  name?: string;
  action?: string;
  roles?: string[] | string;
  definition?: string | null;
  using?: string | null;
  check?: string | null;
  with_check?: string | null;
}

function normalizeProjectUrl(projectUrl: string) {
  const trimmed = projectUrl.trim().replace(/\/$/, "");
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function toBoolean(value: boolean | string | undefined, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["true", "t", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return fallback;
}

function parseRoles(value: string[] | string | undefined) {
  if (!value) {
    return ["public"];
  }

  if (Array.isArray(value)) {
    return value;
  }

  const normalized = value.replace(/[{}]/g, "");
  if (!normalized) {
    return ["public"];
  }

  return normalized
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function tableKey(schema: string, name: string) {
  return `${schema}.${name}`;
}

function extractProjectRef(projectUrl: string) {
  try {
    const host = new URL(projectUrl).hostname;
    const [projectRef] = host.split(".");
    return projectRef || host;
  } catch {
    return projectUrl;
  }
}

async function fetchMeta<T>(project: SupabaseProjectInput, endpoint: string): Promise<T> {
  const normalizedUrl = normalizeProjectUrl(project.projectUrl);
  const url = `${normalizedUrl}/pg/meta/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      apikey: project.serviceRoleKey,
      authorization: `Bearer ${project.serviceRoleKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new SchemaFetchError(`Supabase returned ${response.status} for ${endpoint}: ${text}`);
  }

  return (await response.json()) as T;
}

function ensureTableMapEntry(map: Record<string, SchemaTable>, schema: string, name: string) {
  const key = tableKey(schema, name);
  if (!map[key]) {
    map[key] = {
      schema,
      name,
      rlsEnabled: false,
      columns: {},
      indexes: {},
      policies: {}
    };
  }
  return map[key];
}

export async function testSupabaseConnection(project: SupabaseProjectInput) {
  const normalizedUrl = normalizeProjectUrl(project.projectUrl);
  const tables = await fetchMeta<RawTable[]>(project, "tables?limit=1");

  return {
    projectRef: extractProjectRef(normalizedUrl),
    projectUrl: normalizedUrl,
    sampleTableCount: Array.isArray(tables) ? tables.length : 0
  };
}

export async function fetchProjectSchema(project: SupabaseProjectInput): Promise<SchemaSnapshot> {
  const normalizedUrl = normalizeProjectUrl(project.projectUrl);
  const [tablesRaw, columnsRaw, indexesRaw, policiesRaw] = await Promise.all([
    fetchMeta<RawTable[]>(project, "tables?included_schemas=public,auth,storage"),
    fetchMeta<RawColumn[]>(project, "columns?included_schemas=public,auth,storage"),
    fetchMeta<RawIndex[]>(project, "indexes?included_schemas=public,auth,storage"),
    fetchMeta<RawPolicy[]>(project, "policies?included_schemas=public,auth,storage")
  ]);

  const tables: Record<string, SchemaTable> = {};

  for (const rawTable of tablesRaw ?? []) {
    const schema = rawTable.schema || "public";
    const name = rawTable.name;

    if (!name) {
      continue;
    }

    tables[tableKey(schema, name)] = {
      schema,
      name,
      rlsEnabled: toBoolean(rawTable.rls_enabled ?? rawTable.is_rls_enabled),
      columns: {},
      indexes: {},
      policies: {}
    };
  }

  for (const rawColumn of columnsRaw ?? []) {
    const schema = rawColumn.schema || rawColumn.table_schema || "public";
    const tableName = rawColumn.table || rawColumn.table_name;
    const columnName = rawColumn.name;

    if (!tableName || !columnName) {
      continue;
    }

    const table = ensureTableMapEntry(tables, schema, tableName);
    const column: SchemaColumn = {
      name: columnName,
      dataType: rawColumn.format || rawColumn.data_type || "unknown",
      isNullable: toBoolean(rawColumn.is_nullable, true),
      defaultValue: rawColumn.default_value ?? null
    };

    table.columns[column.name] = column;
  }

  for (const rawIndex of indexesRaw ?? []) {
    const schema = rawIndex.schema || "public";
    const tableName = rawIndex.table;
    const indexName = rawIndex.name;

    if (!tableName || !indexName) {
      continue;
    }

    const table = ensureTableMapEntry(tables, schema, tableName);
    const index: SchemaIndex = {
      name: indexName,
      definition: rawIndex.definition || rawIndex.indexdef || "",
      isUnique: toBoolean(rawIndex.is_unique),
      isPrimary: toBoolean(rawIndex.is_primary)
    };

    table.indexes[index.name] = index;
  }

  for (const rawPolicy of policiesRaw ?? []) {
    const schema = rawPolicy.schema || "public";
    const tableName = rawPolicy.table;
    const policyName = rawPolicy.name;

    if (!tableName || !policyName) {
      continue;
    }

    const table = ensureTableMapEntry(tables, schema, tableName);
    const policy: SchemaPolicy = {
      name: policyName,
      action: rawPolicy.action || "all",
      roles: parseRoles(rawPolicy.roles),
      usingExpression: rawPolicy.using || rawPolicy.definition || null,
      checkExpression: rawPolicy.with_check || rawPolicy.check || null
    };

    table.policies[policy.name] = policy;
  }

  return {
    projectName: project.name,
    projectRef: extractProjectRef(normalizedUrl),
    generatedAt: new Date().toISOString(),
    tables
  };
}

export { SchemaFetchError };
