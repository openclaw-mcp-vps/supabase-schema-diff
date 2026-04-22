"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PaywallUnlockForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/paywall/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Unable to unlock access");
        return;
      }

      setStatus("success");
      setMessage("Access granted. Redirecting to dashboard...");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch {
      setStatus("error");
      setMessage("Request failed. Please retry.");
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleUnlock}>
      <label className="block text-sm font-medium text-slate-200" htmlFor="unlock-email">
        Purchase email
      </label>
      <Input
        id="unlock-email"
        name="unlock-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <Button type="submit" variant="secondary" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Checking purchase..." : "Unlock Access"}
      </Button>

      {message ? (
        <p className={status === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
