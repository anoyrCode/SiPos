import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { formatDateID } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeDayStatus,
  computeStatusMasuk,
  computeStatusPulang,
  computeMenitTelatMasuk,
  computeMenitLebihAwalPulang,
  isHariLiburPegawai,
  todayJakarta,
  STATUS_LABEL,
  formatJamWIB,
  type AbsensiStatus,
} from "@/lib/absensi-status";
import { DateFilter } from "./date-filter";
import { BulanFilter } from "./bulan-filter";
import { StatusFilter } from "./status-filter";
import { PengaturanAbsensiForm } from "./pengaturan-form";
import { KeterlambatanExport } from "./keterlambatan-export";

type Row = {
  pegawaiId: string;
  nama: string;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  status: AbsensiStatus;
};

export type TelatMasukRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
  menitTelat: number;
};

export type TelatKeluarRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
};

export type CurangRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
  jamPulangJadwal: string | null;
  jamPulangAktual: string | null;
  menitLebihAwal: number;
};

const STATUS_VARIANT: Record<
  AbsensiStatus,
  "default" | "primary" | "positive" | "negative" | "warning" | "outline"
> = {
  normal: "positive",
  telat: "warning",
  curang: "negative",
  telat_clock_out: "negative",
  belum_clock_out: "warning",
  alpa: "negative",
  libur: "outline",
  belum_absen: "outline",
  masuk_libur: "primary",
};

/** "HH:MM:SS" (kolom Postgres `time`) -> "HH:MM". Bukan timestamptz, jangan pakai formatJamWIB. */
function formatJamJadwal(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

/** Semua tanggal "YYYY-MM-DD" dalam 1 bulan (format bulan: "YYYY-MM"). */
function datesInMonth(bulan: string): string[] {
  const [yStr, mStr] = bulan.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${yStr}-${mStr}-${String(d).padStart(2, "0")}`);
  }
  return dates;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const mode = getStr(sp.mode) === "bulanan" ? "bulanan" : "tanggal";
  const tanggal = getStr(sp.tanggal) || todayJakarta();
  const bulan = getStr(sp.bulan) || todayJakarta().slice(0, 7);
  const q = getStr(sp.q);
  const statusFilter = getStr(sp.status);
  const monthDates = mode === "bulanan" ? datesInMonth(bulan) : [];

  const supabase = await createClient();

  let pegawaiQuery = supabase
    .from("pegawai")
    .select("id, nama, jam_masuk_jadwal, jam_pulang_jadwal, hari_libur")
    .order("nama");
  if (q) {
    const term = q.replace(/[,()*%_]/g, " ").trim();
    if (term) pegawaiQuery = pegawaiQuery.ilike("nama", `%${term}%`);
  }

  const absensiQuery =
    mode === "bulanan"
      ? supabase
          .from("absensi")
          .select("pegawai_id, tanggal, jam_masuk_aktual, jam_pulang_aktual")
          .gte("tanggal", monthDates[0])
          .lte("tanggal", monthDates[monthDates.length - 1])
      : supabase
          .from("absensi")
          .select("pegawai_id, tanggal, jam_masuk_aktual, jam_pulang_aktual")
          .eq("tanggal", tanggal);

  const [{ data: pegawaiList }, { data: absensiRows }, { data: setting }] =
    await Promise.all([
      pegawaiQuery,
      absensiQuery,
      supabase
        .from("absensi_pengaturan")
        .select("lokasi_lat, lokasi_long, radius_meter")
        .limit(1)
        .maybeSingle(),
    ]);

  const absensiMap = new Map(
    (absensiRows ?? []).map((r) => [`${r.pegawai_id}_${r.tanggal}`, r]),
  );

  const allRows: Row[] = (pegawaiList ?? []).map((p) => {
    const record = absensiMap.get(`${p.id}_${tanggal}`) ?? null;
    const jadwal = {
      jam_masuk_jadwal: p.jam_masuk_jadwal,
      jam_pulang_jadwal: p.jam_pulang_jadwal,
      hari_libur: p.hari_libur,
    };
    return {
      pegawaiId: p.id,
      nama: p.nama,
      jamMasukAktual: record?.jam_masuk_aktual ?? null,
      jamPulangAktual: record?.jam_pulang_aktual ?? null,
      status: computeDayStatus(tanggal, record, jadwal),
    };
  });

  const isStatusFilterActive =
    !!statusFilter && Object.hasOwn(STATUS_LABEL, statusFilter);
  const rows: Row[] = isStatusFilterActive
    ? allRows.filter((r) => r.status === statusFilter)
    : allRows;

  const telatMasukRows: TelatMasukRow[] = [];
  const telatKeluarRows: TelatKeluarRow[] = [];
  const curangRows: CurangRow[] = [];

  if (mode === "bulanan") {
    for (const p of pegawaiList ?? []) {
      const jadwal = {
        jam_masuk_jadwal: p.jam_masuk_jadwal,
        jam_pulang_jadwal: p.jam_pulang_jadwal,
        hari_libur: p.hari_libur,
      };
      for (const tgl of monthDates) {
        if (isHariLiburPegawai(tgl, jadwal)) continue;
        const record = absensiMap.get(`${p.id}_${tgl}`) ?? null;
        // Dicek independen (bukan computeDayStatus) — 1 hari bisa masuk ke
        // kedua tabel sekaligus, mis. telat clock-in DAN curang/telat clock-out
        // di hari yang sama. computeDayStatus cuma cocok utk 1 badge ringkasan
        // (dipakai tabel "Per Tanggal"), bukan utk daftar independen begini.
        // Hari libur pegawai dikecualikan total dari laporan bulanan (di atas).
        if (computeStatusMasuk(tgl, record, jadwal) === "telat") {
          telatMasukRows.push({
            pegawaiId: p.id,
            nama: p.nama,
            tanggal: tgl,
            menitTelat: computeMenitTelatMasuk(tgl, record, jadwal),
          });
        }
        const statusPulang = computeStatusPulang(tgl, record, jadwal);
        if (statusPulang === "telat_clock_out") {
          telatKeluarRows.push({ pegawaiId: p.id, nama: p.nama, tanggal: tgl });
        }
        if (statusPulang === "curang") {
          curangRows.push({
            pegawaiId: p.id,
            nama: p.nama,
            tanggal: tgl,
            jamPulangJadwal: formatJamJadwal(jadwal.jam_pulang_jadwal),
            jamPulangAktual: record?.jam_pulang_aktual ?? null,
            menitLebihAwal: computeMenitLebihAwalPulang(tgl, record, jadwal),
          });
        }
      }
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "masuk",
      header: "Clock In",
      cell: (r) => <span className="font-mono">{formatJamWIB(r.jamMasukAktual)}</span>,
    },
    {
      key: "pulang",
      header: "Clock Out",
      cell: (r) => <span className="font-mono">{formatJamWIB(r.jamPulangAktual)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      ),
    },
  ];

  const telatMasukColumns: Column<TelatMasukRow>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) => formatDateID(r.tanggal),
    },
    {
      key: "menit",
      header: "Telat (menit)",
      cell: (r) => (
        <span className="font-mono font-semibold text-negative">{r.menitTelat}</span>
      ),
    },
  ];

  const telatKeluarColumns: Column<TelatKeluarRow>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) => formatDateID(r.tanggal),
    },
  ];

  const curangColumns: Column<CurangRow>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) => formatDateID(r.tanggal),
    },
    {
      key: "jadwalPulang",
      header: "Jadwal Pulang",
      cell: (r) => <span className="font-mono">{r.jamPulangJadwal ?? "—"}</span>,
    },
    {
      key: "jamPulang",
      header: "Jam Clock Out",
      cell: (r) => <span className="font-mono">{formatJamWIB(r.jamPulangAktual)}</span>,
    },
    {
      key: "menit",
      header: "Menit Lebih Awal",
      cell: (r) => (
        <span className="font-mono font-semibold text-negative">{r.menitLebihAwal}</span>
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={ClipboardCheck}
        title="Rekap Absensi"
        description="Rekap kehadiran seluruh pegawai per tanggal atau per bulan."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {mode === "tanggal" ? (
            <DateFilter value={tanggal} />
          ) : (
            <BulanFilter value={bulan} />
          )}
          <SearchInput placeholder="Cari nama pegawai…" className="w-full sm:w-56" />
          {mode === "tanggal" && <StatusFilter value={statusFilter} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <Button asChild size="sm" variant={mode === "tanggal" ? "default" : "ghost"}>
              <Link href="/rekap-absensi?mode=tanggal">Per Tanggal</Link>
            </Button>
            <Button asChild size="sm" variant={mode === "bulanan" ? "default" : "ghost"}>
              <Link href="/rekap-absensi?mode=bulanan">Per Bulan</Link>
            </Button>
          </div>
          <PengaturanAbsensiForm
            initial={{
              lokasi_lat: setting?.lokasi_lat ?? null,
              lokasi_long: setting?.lokasi_long ?? null,
              radius_meter: setting?.radius_meter ?? 150,
            }}
          />
        </div>
      </div>

      {mode === "tanggal" ? (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.pegawaiId}
          isFiltered={!!q || isStatusFilterActive}
          empty="Belum ada data pegawai."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Rekap keterlambatan bulan {bulan}</h2>
            <KeterlambatanExport
              bulan={bulan}
              telatMasuk={telatMasukRows}
              telatKeluar={telatKeluarRows}
              curang={curangRows}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Telat Clock In</h3>
            <DataTable
              columns={telatMasukColumns}
              rows={telatMasukRows}
              getRowId={(r) => `${r.pegawaiId}_${r.tanggal}`}
              isFiltered={!!q}
              empty="Tidak ada keterlambatan clock in bulan ini."
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Telat Clock Out</h3>
            <DataTable
              columns={telatKeluarColumns}
              rows={telatKeluarRows}
              getRowId={(r) => `${r.pegawaiId}_${r.tanggal}`}
              isFiltered={!!q}
              empty="Tidak ada keterlambatan clock out bulan ini."
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Curang</h3>
            <DataTable
              columns={curangColumns}
              rows={curangRows}
              getRowId={(r) => `${r.pegawaiId}_${r.tanggal}`}
              isFiltered={!!q}
              empty="Tidak ada kejadian curang bulan ini."
            />
          </div>
        </>
      )}
    </div>
  );
}
