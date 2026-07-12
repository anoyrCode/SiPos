"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadExcel } from "@/lib/export";
import { formatDateID } from "@/lib/format";
import { PENGAJUAN_STATUS_LABEL, type PengajuanStatus } from "@/lib/absensi-status";

export type PengajuanBulananRow = {
  pengajuanId: string;
  nama: string;
  kategori: "izin" | "sakit" | "cuti";
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  status: PengajuanStatus;
  keterangan: string | null;
  alasanPenolakan: string | null;
};

const KATEGORI_LABEL: Record<PengajuanBulananRow["kategori"], string> = {
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
};

export function PengajuanBulananExport({
  bulan,
  rows,
}: {
  bulan: string;
  rows: PengajuanBulananRow[];
}) {
  function handleExport() {
    downloadExcel(
      `pengajuan-izin-sakit-cuti-${bulan}.xlsx`,
      "Pengajuan",
      rows.map((r) => ({
        Pegawai: r.nama,
        Kategori: KATEGORI_LABEL[r.kategori],
        "Dari Tanggal": formatDateID(r.tanggalMulai),
        "Sampai Tanggal": formatDateID(r.tanggalSelesai),
        "Jumlah Hari": r.jumlahHari,
        Status: PENGAJUAN_STATUS_LABEL[r.status],
        Keterangan: r.keterangan ?? "",
        "Alasan Penolakan": r.alasanPenolakan ?? "",
      })),
      [24, 10, 14, 14, 12, 12, 30, 30],
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport}>
      <Download data-icon="inline-start" />
      Excel
    </Button>
  );
}
