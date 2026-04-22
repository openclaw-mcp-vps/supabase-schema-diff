import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "supabase_schema_diff_access";
const DEFAULT_ACCESS_DAYS = 31;

interface AccessPayload {
  email: string;
  iat: number;
  exp: number;
}

export interface AccessState {
  valid: boolean;
  email: string | null;
  expiresAt: number | null;
}

function getSigningSecret() {
  return process.env.PAYWALL_COOKIE_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "local-dev-secret-change-me";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function createAccessCookieValue(email: string, days = DEFAULT_ACCESS_DAYS) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + days * 24 * 60 * 60;
  const payload: AccessPayload = {
    email: email.trim().toLowerCase(),
    iat,
    exp
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAccessCookieValue(rawValue: string | undefined): AccessState {
  if (!rawValue) {
    return { valid: false, email: null, expiresAt: null };
  }

  const [encoded, signature] = rawValue.split(".");
  if (!encoded || !signature) {
    return { valid: false, email: null, expiresAt: null };
  }

  const expected = sign(encoded);
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(signature, "utf8");

  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
    return { valid: false, email: null, expiresAt: null };
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as AccessPayload;

    if (!parsed.email || !parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, email: null, expiresAt: null };
    }

    return {
      valid: true,
      email: parsed.email,
      expiresAt: parsed.exp * 1000
    };
  } catch {
    return { valid: false, email: null, expiresAt: null };
  }
}

export function accessCookieConfig(maxAgeDays = DEFAULT_ACCESS_DAYS) {
  return {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeDays * 24 * 60 * 60
  };
}
