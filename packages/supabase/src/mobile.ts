import { createSupabaseClient } from "./client";

export const supabaseMobile = createSupabaseClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
});
