import { createBrowserClient, createServerClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url) throw new Error("Missing Supabase URL");
  if (!anonKey) throw new Error("Missing Supabase anon key");
  return createBrowserClient(url, anonKey);
}

export function createSupabaseServer(cookieStore: {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, options: Record<string, unknown>) => void;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url) throw new Error("Missing Supabase URL");
  if (!anonKey) throw new Error("Missing Supabase anon key");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const sb = cookieStore.get("sb-access-token");
        const sr = cookieStore.get("sb-refresh-token");
        const out: { name: string; value: string }[] = [];
        if (sb) out.push({ name: "sb-access-token", value: sb.value });
        if (sr) out.push({ name: "sb-refresh-token", value: sr.value });
        return out;
      },
      setAll(cookies) {
        for (const c of cookies) {
          cookieStore.set(c.name, c.value, c.options as Record<string, unknown>);
        }
      }
    }
  });
}
