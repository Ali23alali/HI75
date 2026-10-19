import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey && !url.includes("your-project"));

if (!isConfigured) {
  console.warn(
    "[hi] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in."
  );
}

/**
 * Browser client. Uses ONLY the public anon/publishable key.
 * The service_role key must never appear in client code.
 */
export const supabase = createClient<Database>(
  url || "http://127.0.0.1:54321",
  anonKey || "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "hi.auth",
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

export const PROJECT_URL = url;
