import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy";
import { upsertPurchase } from "@/lib/purchase-store";

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
}

function parseStripeSignature(header: string) {
  const items = header.split(",");
  const values: Record<string, string> = {};

  for (const item of items) {
    const [key, value] = item.split("=");
    if (key && value) {
      values[key.trim()] = value.trim();
    }
  }

  return {
    timestamp: values.t,
    signature: values.v1
  };
}

function verifyStripeSignature(payload: string, signatureHeader: string, webhookSecret: string) {
  const { timestamp, signature } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

  const expectedBytes = Buffer.from(expectedSignature, "utf8");
  const signatureBytes = Buffer.from(signature, "utf8");

  if (expectedBytes.length !== signatureBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, signatureBytes);
}

function readStripeEmail(event: StripeEvent) {
  const object = event.data.object;
  const objectAny = object as Record<string, unknown>;

  return (
    (objectAny.customer_details as { email?: string } | undefined)?.email ||
    (objectAny.customer_email as string | undefined) ||
    (objectAny.receipt_email as string | undefined) ||
    null
  );
}

async function handleStripeEvent(event: StripeEvent) {
  const email = readStripeEmail(event);

  if (!email) {
    return;
  }

  const createdAt = event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString();

  await upsertPurchase({
    email,
    source: "stripe",
    createdAt,
    expiresAt: null,
    metadata: {
      eventId: event.id,
      eventType: event.type
    }
  });
}

async function handleLemonSqueezyPayload(payload: string, signature: string, secret: string) {
  if (!verifyLemonSqueezySignature(payload, signature, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid Lemon Squeezy signature" }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    meta?: { event_name?: string };
    data?: { attributes?: { user_email?: string } };
  };

  const email = event.data?.attributes?.user_email;
  if (email) {
    await upsertPurchase({
      email,
      source: "manual",
      createdAt: new Date().toISOString(),
      expiresAt: null,
      metadata: {
        eventType: event.meta?.event_name ?? "lemonsqueezy"
      }
    });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const payload = await request.text();

  const lemonSignature = request.headers.get("x-signature");
  const lemonSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (lemonSignature && lemonSecret) {
    return handleLemonSqueezyPayload(payload, lemonSignature, lemonSecret);
  }

  const stripeSignature = request.headers.get("stripe-signature");
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSignature || !stripeSecret) {
    return NextResponse.json({ ok: false, error: "Missing webhook signature or secret" }, { status: 400 });
  }

  if (!verifyStripeSignature(payload, stripeSignature, stripeSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid Stripe signature" }, { status: 401 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if (["checkout.session.completed", "invoice.paid", "payment_intent.succeeded"].includes(event.type)) {
    await handleStripeEvent(event);
  }

  return NextResponse.json({ ok: true });
}
