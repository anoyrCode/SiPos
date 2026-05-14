import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client untuk komponen Client (browser).
 * Dipakai di Client Components / event handler.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
