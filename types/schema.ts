export type ChangeSeverity = "breaking" | "warning" | "safe";

export type ResourceType = "table" | "column" | "index" | "policy" | "rls";

export interface SupabaseProjectInput {
  name: string;
  projectUrl: string;
  serviceRoleKey: string;
}

export interface SchemaColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
}

export interface SchemaIndex {
  name: string;
  definition: string;
  isUnique: boolean;
  isPrimary: boolean;
}

export interface SchemaPolicy {
  name: string;
  action: string;
  roles: string[];
  usingExpression: string | null;
  checkExpression: string | null;
}

export interface SchemaTable {
  schema: string;
  name: string;
  rlsEnabled: boolean;
  columns: Record<string, SchemaColumn>;
  indexes: Record<string, SchemaIndex>;
  policies: Record<string, SchemaPolicy>;
}

export interface SchemaSnapshot {
  projectName: string;
  projectRef: string;
  generatedAt: string;
  tables: Record<string, SchemaTable>;
}

export interface DiffItem {
  id: string;
  severity: ChangeSeverity;
  resourceType: ResourceType;
  table: string;
  entity: string;
  summary: string;
  before: string | null;
  after: string | null;
  impact: string;
  recommendation: string;
}

export interface DiffSummary {
  breaking: number;
  warning: number;
  safe: number;
  total: number;
}

export interface SchemaDiffResult {
  sourceProject: string;
  targetProject: string;
  generatedAt: string;
  summary: DiffSummary;
  changes: DiffItem[];
  unifiedDiff: string;
  unifiedDiffHtml: string;
  sourceSnapshot: SchemaSnapshot;
  targetSnapshot: SchemaSnapshot;
}

export interface PurchaseRecord {
  email: string;
  source: "stripe" | "manual";
  createdAt: string;
  expiresAt: string | null;
  metadata: Record<string, string>;
}
