import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client untuk Server Components, Server Actions, dan Route Handlers.
 *
 * Catatan Next.js 16: `cookies()` bersifat async, jadi helper ini async.
 * `setAll` bisa gagal saat dipanggil dari Server Component (read-only);
 * itu aman diabaikan selama refresh sesi ditangani di `proxy.ts` (Fase 1).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Dipanggil dari Server Component — abaikan, sesi di-refresh di proxy.ts.
          }
        },
      },
    },
  );
}
