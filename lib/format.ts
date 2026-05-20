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

/** "—" untuk nilai kosong. */
export function orDash(value: string | null | undefined): string {
  const v = (value ?? "").toString().trim();
  return v === "" ? "—" : v;
}
