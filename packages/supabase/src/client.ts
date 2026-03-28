import { createClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export function createSupabaseClient(env: SupabaseEnv) {
  if (!env.url) throw new Error("Missing Supabase URL");
  if (!env.anonKey) throw new Error("Missing Supabase anon key");
  return createClient(env.url, env.anonKey);
}
