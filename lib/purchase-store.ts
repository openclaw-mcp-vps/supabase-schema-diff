import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

import type { PurchaseRecord } from "@/types/schema";

const PURCHASE_FILE = path.join(process.cwd(), ".data", "purchases.json");

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? postgres(databaseUrl, { prepare: false, max: 1 }) : null;
let dbInitialized = false;

interface FileStore {
  records: PurchaseRecord[];
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function ensureDatabase() {
  if (!sql || dbInitialized) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS purchase_entitlements (
      email TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;

  dbInitialized = true;
}

async function readStoreFile(): Promise<FileStore> {
  try {
    const existing = await readFile(PURCHASE_FILE, "utf8");
    const parsed = JSON.parse(existing) as FileStore;
    return {
      records: Array.isArray(parsed.records) ? parsed.records : []
    };
  } catch {
    return { records: [] };
  }
}

async function writeStoreFile(store: FileStore) {
  await mkdir(path.dirname(PURCHASE_FILE), { recursive: true });
  await writeFile(PURCHASE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function upsertPurchase(record: PurchaseRecord) {
  const normalized: PurchaseRecord = {
    ...record,
    email: normalizeEmail(record.email),
    metadata: record.metadata ?? {}
  };

  if (sql) {
    await ensureDatabase();
    await sql`
      INSERT INTO purchase_entitlements (email, source, created_at, expires_at, metadata)
      VALUES (
        ${normalized.email},
        ${normalized.source},
        ${normalized.createdAt},
        ${normalized.expiresAt},
        ${sql.json(normalized.metadata)}
      )
      ON CONFLICT (email) DO UPDATE SET
        source = EXCLUDED.source,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata
    `;
    return;
  }

  const store = await readStoreFile();
  const next = store.records.filter((entry) => normalizeEmail(entry.email) !== normalized.email);
  next.push(normalized);
  await writeStoreFile({ records: next });
}

export async function hasActivePurchase(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (sql) {
    await ensureDatabase();
    const rows = await sql<{ expires_at: string | null }[]>`
      SELECT expires_at
      FROM purchase_entitlements
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return false;
    }

    const expiry = rows[0].expires_at;
    if (!expiry) {
      return true;
    }

    return new Date(expiry).getTime() > Date.now();
  }

  const store = await readStoreFile();
  const match = store.records.find((entry) => normalizeEmail(entry.email) === normalizedEmail);

  if (!match) {
    return false;
  }

  if (!match.expiresAt) {
    return true;
  }

  return new Date(match.expiresAt).getTime() > Date.now();
}
