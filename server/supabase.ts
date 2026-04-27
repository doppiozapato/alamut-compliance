import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log("[supabase] SUPABASE_URL present:", !!supabaseUrl);
console.log("[supabase] SUPABASE_ANON_KEY present:", !!supabaseKey);

export const supabaseEnabled = !!(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(supabaseUrl as string, supabaseKey as string)
  : null;

if (!supabaseEnabled) {
  console.warn(
    "[supabase] SUPABASE_URL / SUPABASE_ANON_KEY not set — running with in-memory seed data only.",
  );
}
