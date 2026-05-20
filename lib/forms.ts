/** Hasil standar server action (create/update/delete). */
export type FormResult = { ok: true } | { ok: false; error: string };

type DbError = { code?: string; message?: string } | null;

/** Pesan error ramah dari error PostgREST/Supabase. */
export function dbErrorMessage(
  error: DbError,
  fallback = "Terjadi kesalahan. Coba lagi.",
): string {
  if (!error) return fallback;
  switch (error.code) {
    case "23505":
      return "Data dengan nilai unik tersebut sudah ada.";
    case "23503":
      return "Data masih dipakai/terkait data lain.";
    case "42501":
      return "Anda tidak punya izin untuk aksi ini.";
    default:
      return error.message || fallback;
  }
}
