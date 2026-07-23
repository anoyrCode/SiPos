"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadExcel } from "@/lib/export";
import { formatDateID } from "@/lib/format";
import {
  formatJamWIB,
  formatSesiStatusLabel,
  STATUS_LABEL,
  type AbsensiStatus,
  type SesiStatus,
} from "@/lib/absensi-status";

type HarianExportRow = {
  nama: string;
  tanggal: string;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  jamMasukAktual2: string | null;
  jamPulangAktual2: string | null;
  status: AbsensiStatus;
  sesiStatuses: SesiStatus[] | null;
  overrideLokasi: boolean;
  bebasLokasi: boolean;
};

function statusLabel(r: HarianExportRow): string {
  if (r.sesiStatuses && r.sesiStatuses.length > 0) {
    return r.sesiStatuses.map(formatSesiStatusLabel).join(" / ");
  }
  return STATUS_LABEL[r.status];
}

function lokasiLabel(r: HarianExportRow): string {
  if (r.overrideLokasi) return "Manual - di luar radius";
  if (r.bebasLokasi) return "Dikecualikan";
  return "";
}

export function RekapHarianExport({
  dari,
  sampai,
  rows,
}: {
  dari: string;
  sampai: string;
  rows: HarianExportRow[];
}) {
  function handleExport() {
    downloadExcel(
      `rekap-harian-${dari}_${sampai}.xlsx`,
      "Rekap Harian",
      rows.map((r) => ({
        Tanggal: formatDateID(r.tanggal),
        Pegawai: r.nama,
        "Clock In": formatJamWIB(r.jamMasukAktual),
        "Clock Out": formatJamWIB(r.jamPulangAktual),
        "Clock In 2": r.jamMasukAktual2 ? formatJamWIB(r.jamMasukAktual2) : "",
        "Clock Out 2": r.jamPulangAktual2 ? formatJamWIB(r.jamPulangAktual2) : "",
        Status: statusLabel(r),
        Lokasi: lokasiLabel(r),
      })),
      [14, 24, 10, 10, 10, 10, 26, 22],
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
      <Download data-icon="inline-start" />
      Excel
    </Button>
  );
}
