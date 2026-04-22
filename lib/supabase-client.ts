import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function createBrowserSupabaseClient() {
  const url = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export function createServiceSupabaseClient(projectUrl: string, serviceRoleKey: string): SupabaseClient {
  const normalizedUrl = projectUrl.replace(/\/$/, "");
  return createClient(normalizedUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
