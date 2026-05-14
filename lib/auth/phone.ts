/** Domain email sintetis untuk akun wali (login pakai no WA/telp). */
export const WALI_EMAIL_DOMAIN = "wali.sipos.local";

/** Ambil hanya digit dari input nomor telepon. */
export function normalizePhone(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Petakan no telepon (username wali) ke email sintetis Supabase Auth.
 * Contoh: "0812-3456" → "08123456@wali.sipos.local".
 */
export function phoneToWaliEmail(input: string): string {
  return `${normalizePhone(input)}@${WALI_EMAIL_DOMAIN}`;
}
