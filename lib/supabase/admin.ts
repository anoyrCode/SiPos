import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client dengan SERVICE ROLE (bypass RLS).
 * HANYA dipakai di server (server action) untuk operasi admin seperti
 * membuat/menghapus akun wali. Jangan pernah diekspos ke client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
