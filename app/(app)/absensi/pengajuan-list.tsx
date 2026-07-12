import { Badge } from "@/components/ui/badge";
import { formatDateID } from "@/lib/format";
import { PENGAJUAN_STATUS_LABEL, type PengajuanStatus } from "@/lib/absensi-status";

export type PengajuanRow = {
  id: string;
  kategori: "izin" | "sakit" | "cuti";
  tanggalMulai: string;
  tanggalSelesai: string;
  status: PengajuanStatus;
  alasanPenolakan: string | null;
};

const KATEGORI_LABEL: Record<PengajuanRow["kategori"], string> = {
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
};

const STATUS_VARIANT: Record<PengajuanStatus, "warning" | "positive" | "negative"> = {
  menunggu: "warning",
  disetujui: "positive",
  ditolak: "negative",
};

export function PengajuanList({ items }: { items: PengajuanRow[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Riwayat Pengajuan</h2>
      <div className="max-h-60 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {items.map((r) => (
          <div
            key={r.id}
            className="rounded-card border border-border/70 bg-card p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {KATEGORI_LABEL[r.kategori]} · {formatDateID(r.tanggalMulai)}
                {r.tanggalMulai !== r.tanggalSelesai &&
                  ` – ${formatDateID(r.tanggalSelesai)}`}
              </span>
              <Badge variant={STATUS_VARIANT[r.status]}>
                {PENGAJUAN_STATUS_LABEL[r.status]}
              </Badge>
            </div>
            {r.status === "ditolak" && r.alasanPenolakan && (
              <p className="mt-1 text-xs text-muted-foreground">
                Alasan: {r.alasanPenolakan}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
