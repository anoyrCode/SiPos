/** Format tanggal (YYYY-MM-DD / ISO) ke "05 Jun 2026". */
export function formatDateID(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Timestamp (`timestamptz` dari Postgres) → tanggal WIB "YYYY-MM-DD".
 *
 * Memotong string ISO-nya (`.slice(0, 10)`) SALAH: nilainya UTC, sehingga
 * peristiwa antara pukul 00:00–07:00 WIB tercatat sebagai hari SEBELUMNYA.
 * Di pesantren jam segitu justru jam kerja, jadi ini bukan kasus pinggiran.
 */
export function tanggalWib(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "—" untuk nilai kosong. */
export function orDash(value: string | null | undefined): string {
  const v = (value ?? "").toString().trim();
  return v === "" ? "—" : v;
}
