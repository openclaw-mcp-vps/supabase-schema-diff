import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { generateSchemaDiff } from "@/lib/diff-engine";
import { ACCESS_COOKIE_NAME, verifyAccessCookieValue } from "@/lib/paywall";
import { fetchProjectSchema } from "@/lib/schema-parser";
import type { SupabaseProjectInput } from "@/types/schema";

interface SchemaDiffRequest {
  source: SupabaseProjectInput;
  target: SupabaseProjectInput;
}

function parseBody(body: unknown): SchemaDiffRequest {
  const parsed = body as Partial<SchemaDiffRequest>;
  if (!parsed.source || !parsed.target) {
    throw new Error("Missing source or target configuration");
  }

  for (const key of ["source", "target"] as const) {
    const project = parsed[key] as Partial<SupabaseProjectInput>;

    if (!project?.name || !project.projectUrl || !project.serviceRoleKey) {
      throw new Error(`Invalid ${key} project configuration`);
    }
  }

  return parsed as SchemaDiffRequest;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const access = verifyAccessCookieValue(cookieStore.get(ACCESS_COOKIE_NAME)?.value);

  if (!access.valid) {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  try {
    const body = await request.json();
    const { source, target } = parseBody(body);

    const [sourceSnapshot, targetSnapshot] = await Promise.all([fetchProjectSchema(source), fetchProjectSchema(target)]);

    const diff = generateSchemaDiff(sourceSnapshot, targetSnapshot);

    return NextResponse.json({ ok: true, diff });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch schemas";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
