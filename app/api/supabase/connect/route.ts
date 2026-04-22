import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { testSupabaseConnection } from "@/lib/schema-parser";
import { ACCESS_COOKIE_NAME, verifyAccessCookieValue } from "@/lib/paywall";
import type { SupabaseProjectInput } from "@/types/schema";

function validateProjectInput(body: unknown): SupabaseProjectInput {
  const candidate = body as Partial<SupabaseProjectInput>;

  if (!candidate?.name || !candidate.projectUrl || !candidate.serviceRoleKey) {
    throw new Error("Missing required fields: name, projectUrl, serviceRoleKey");
  }

  return {
    name: candidate.name,
    projectUrl: candidate.projectUrl,
    serviceRoleKey: candidate.serviceRoleKey
  };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const access = verifyAccessCookieValue(cookieStore.get(ACCESS_COOKIE_NAME)?.value);

  if (!access.valid) {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  try {
    const body = await request.json();
    const project = validateProjectInput(body);
    const connection = await testSupabaseConnection(project);

    return NextResponse.json({
      ok: true,
      project: {
        ...connection,
        name: project.name
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect to project";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const access = verifyAccessCookieValue(cookieStore.get(ACCESS_COOKIE_NAME)?.value);

  return NextResponse.json({
    paid: access.valid,
    email: access.email
  });
}
