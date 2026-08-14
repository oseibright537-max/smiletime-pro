import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const DEFAULT_SUPABASE_URL = "https://qrcrixopsoypwfmdrdcs.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyY3JpeG9wc295cHdmbWRyZGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1Nzc5MTEsImV4cCI6MjEwMjE1MzkxMX0.RxbnDjRgSYMyKkMaBekKqQdZDAH9dNMVzXPSHOoOoCQ";

function createSupabaseClient() {
  const rawUrl =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env["VITE_SUPABASE_URL"]
      : "") ||
    (typeof process !== "undefined" && process.env
      ? process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]
      : "") ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_URL = (rawUrl || DEFAULT_SUPABASE_URL)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");

  const SUPABASE_PUBLISHABLE_KEY =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
        import.meta.env["VITE_SUPABASE_ANON_KEY"]
      : "") ||
    (typeof process !== "undefined" && process.env
      ? process.env["SUPABASE_PUBLISHABLE_KEY"] ||
        process.env["SUPABASE_ANON_KEY"] ||
        process.env["VITE_SUPABASE_ANON_KEY"] ||
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
      : "") ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
