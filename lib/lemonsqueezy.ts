import { createHmac, timingSafeEqual } from "node:crypto";

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

let lemonConfigured = false;

export function initializeLemonSqueezy() {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    return false;
  }

  if (!lemonConfigured) {
    lemonSqueezySetup({ apiKey });
    lemonConfigured = true;
  }

  return true;
}

export function verifyLemonSqueezySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(signature, "utf8");

  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}
