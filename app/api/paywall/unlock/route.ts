import { NextResponse } from "next/server";

import { accessCookieConfig, ACCESS_COOKIE_NAME, createAccessCookieValue } from "@/lib/paywall";
import { hasActivePurchase } from "@/lib/purchase-store";

interface UnlockRequestBody {
  email?: string;
}

export async function POST(request: Request) {
  let payload: UnlockRequestBody;

  try {
    payload = (await request.json()) as UnlockRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
  }

  const hasPurchase = await hasActivePurchase(email);

  if (!hasPurchase) {
    return NextResponse.json(
      {
        ok: false,
        error: "No active purchase found for this email. Complete checkout first, then retry in 10-20 seconds."
      },
      { status: 404 }
    );
  }

  const cookieValue = createAccessCookieValue(email);
  const response = NextResponse.json({ ok: true, email });
  response.cookies.set(ACCESS_COOKIE_NAME, cookieValue, accessCookieConfig());
  return response;
}
