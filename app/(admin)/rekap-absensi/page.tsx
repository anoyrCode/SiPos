import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRekapAbsensiAkses } from "@/lib/auth/dal";
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
  type PengajuanStatus,
  PENGAJUAN_STATUS_LABEL,
} from "@/lib/absensi-status";
import { DateFilter } from "./date-filter";
import { BulanFilter } from "./bulan-filter";
import { StatusFilter } from "./status-filter";
import { PengaturanAbsensiForm } from "./pengaturan-form";
import { KeterlambatanExport } from "./keterlambatan-export";
import { PersetujuanPanel } from "./persetujuan-panel";
import { PengajuanStatusFilter } from "./pengajuan-status-filter";
import { LiburKhususDialog, type LiburKhususRow } from "./libur-khusus-dialog";
import {
  PengajuanBulananExport,
  type PengajuanBulananRow,
} from "./pengajuan-bulanan-export";

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
  izin: "outline",
  sakit: "warning",
  cuti: "default",
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
  const profile = await requireRekapAbsensiAkses();
  const isMaster = profile.perms.master || profile.perms.super;
  const canApprove = isMaster || profile.perms.approve_absensi;
  const canViewRekap = isMaster || profile.perms.rekap_absensi;
  const sp = await searchParams;
  const modeRaw = getStr(sp.mode);
  const mode =
    modeRaw === "persetujuan" && canApprove
      ? "persetujuan"
      : modeRaw === "bulanan" && canViewRekap
        ? "bulanan"
        : canViewRekap
          ? "tanggal"
          : "persetujuan";
  const pengajuanStatus: PengajuanStatus =
    getStr(sp.pstatus) === "disetujui"
      ? "disetujui"
      : getStr(sp.pstatus) === "ditolak"
        ? "ditolak"
        : "menunggu";
  const tanggal = getStr(sp.tanggal) || todayJakarta();
  const bulan = getStr(sp.bulan) || todayJakarta().slice(0, 7);
  const q = getStr(sp.q);
  const statusFilter = getStr(sp.status);
  const monthDates = mode === "bulanan" ? datesInMonth(bulan) : [];

  if (!canViewRekap) {
    // Approver tanpa akses rekap (perm_master/perm_rekap_absensi): skip semua
    // query rekap tanggal/bulanan (data GPS & jam kerja SEMUA pegawai),
    // langsung ke tampilan Persetujuan saja.
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader
          icon={ClipboardCheck}
          title="Persetujuan Absensi"
          description="Setujui atau tolak pengajuan izin/sakit/cuti pegawai."
        />
        <PengajuanStatusFilter value={pengajuanStatus} />
        <PersetujuanPanel statusFilter={pengajuanStatus} />
      </div>
    );
  }

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
          .select("pegawai_id, tanggal, jam_masuk_aktual, jam_pulang_aktual, kategori_absen")
          .gte("tanggal", monthDates[0])
          .lte("tanggal", monthDates[monthDates.length - 1])
      : supabase
          .from("absensi")
          .select("pegawai_id, tanggal, jam_masuk_aktual, jam_pulang_aktual, kategori_absen")
          .eq("tanggal", tanggal);

  const [
    { data: pegawaiList },
    { data: absensiRows },
    { data: setting },
    { data: liburKhususRows },
  ] = await Promise.all([
    pegawaiQuery,
    absensiQuery,
    supabase
      .from("absensi_pengaturan")
      .select("lokasi_lat, lokasi_long, radius_meter, toleransi_menit")
      .limit(1)
      .maybeSingle(),
    supabase.from("libur_khusus").select("tanggal, keterangan").order("tanggal"),
  ]);

  const toleransiMenit = setting?.toleransi_menit ?? 0;
  const liburKhususList: LiburKhususRow[] = liburKhususRows ?? [];
  const liburKhususSet = new Set(liburKhususList.map((l) => l.tanggal));

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
      status: computeDayStatus(tanggal, record, jadwal, toleransiMenit, liburKhususSet),
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
        if (isHariLiburPegawai(tgl, jadwal, liburKhususSet)) continue;
        const record = absensiMap.get(`${p.id}_${tgl}`) ?? null;
        // Dicek independen (bukan computeDayStatus) — 1 hari bisa masuk ke
        // kedua tabel sekaligus, mis. telat clock-in DAN curang/telat clock-out
        // di hari yang sama. computeDayStatus cuma cocok utk 1 badge ringkasan
        // (dipakai tabel "Per Tanggal"), bukan utk daftar independen begini.
        // Hari libur pegawai dikecualikan total dari laporan bulanan (di atas).
        if (computeStatusMasuk(tgl, record, jadwal, toleransiMenit) === "telat") {
          telatMasukRows.push({
            pegawaiId: p.id,
            nama: p.nama,
            tanggal: tgl,
            menitTelat: computeMenitTelatMasuk(tgl, record, jadwal, toleransiMenit),
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

  let pengajuanBulananRows: PengajuanBulananRow[] = [];
  if (mode === "bulanan" && canApprove) {
    const { data: pengajuanRaw } = await supabase
      .from("absensi_pengajuan")
      .select(
        "id, kategori, tanggal_mulai, tanggal_selesai, status, keterangan, alasan_penolakan, pegawai:pegawai(nama)",
      )
      .lte("tanggal_mulai", monthDates[monthDates.length - 1])
      .gte("tanggal_selesai", monthDates[0])
      .order("tanggal_mulai");

    type PegawaiEmbed = { nama: string } | { nama: string }[] | null;
    const embedNama = (e: PegawaiEmbed): string =>
      e ? (Array.isArray(e) ? (e[0]?.nama ?? "—") : e.nama) : "—";

    pengajuanBulananRows = (
      (pengajuanRaw ?? []) as unknown as {
        id: string;
        kategori: PengajuanBulananRow["kategori"];
        tanggal_mulai: string;
        tanggal_selesai: string;
        status: PengajuanBulananRow["status"];
        keterangan: string | null;
        alasan_penolakan: string | null;
        pegawai: PegawaiEmbed;
      }[]
    ).map((r) => {
      const hari =
        Math.round(
          (new Date(`${r.tanggal_selesai}T00:00:00`).getTime() -
            new Date(`${r.tanggal_mulai}T00:00:00`).getTime()) /
            86400000,
        ) + 1;
      return {
        pengajuanId: r.id,
        nama: embedNama(r.pegawai),
        kategori: r.kategori,
        tanggalMulai: r.tanggal_mulai,
        tanggalSelesai: r.tanggal_selesai,
        jumlahHari: hari,
        status: r.status,
        keterangan: r.keterangan,
        alasanPenolakan: r.alasan_penolakan,
      };
    });
  }

  const pengajuanBulananColumns: Column<PengajuanBulananRow>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "kategori",
      header: "Kategori",
      cell: (r) => (
        <Badge variant="outline">
          {r.kategori === "izin" ? "Izin" : r.kategori === "sakit" ? "Sakit" : "Cuti"}
        </Badge>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) =>
        r.tanggalMulai === r.tanggalSelesai
          ? formatDateID(r.tanggalMulai)
          : `${formatDateID(r.tanggalMulai)} – ${formatDateID(r.tanggalSelesai)}`,
    },
    {
      key: "hari",
      header: "Jumlah Hari",
      cell: (r) => <span className="font-mono">{r.jumlahHari}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant={
            r.status === "disetujui"
              ? "positive"
              : r.status === "ditolak"
                ? "negative"
                : "warning"
          }
        >
          {PENGAJUAN_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
  ];

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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto">
            <Button
              asChild
              size="sm"
              variant={mode === "tanggal" ? "default" : "ghost"}
              className="flex-1 sm:flex-none"
            >
              <Link href="/rekap-absensi?mode=tanggal">Per Tanggal</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={mode === "bulanan" ? "default" : "ghost"}
              className="flex-1 sm:flex-none"
            >
              <Link href="/rekap-absensi?mode=bulanan">Per Bulan</Link>
            </Button>
            {canApprove && (
              <Button
                asChild
                size="sm"
                variant={mode === "persetujuan" ? "default" : "ghost"}
                className="flex-1 sm:flex-none"
              >
                <Link href="/rekap-absensi?mode=persetujuan">Persetujuan</Link>
              </Button>
            )}
          </div>
          {isMaster && (
            <>
              <PengaturanAbsensiForm
                initial={{
                  lokasi_lat: setting?.lokasi_lat ?? null,
                  lokasi_long: setting?.lokasi_long ?? null,
                  radius_meter: setting?.radius_meter ?? 150,
                  toleransi_menit: toleransiMenit,
                }}
                triggerClassName="w-full sm:w-auto"
              />
              <LiburKhususDialog initial={liburKhususList} />
            </>
          )}
        </div>
      </div>

      {mode === "persetujuan" ? (
        <div className="space-y-4">
          <PengajuanStatusFilter value={pengajuanStatus} />
          <PersetujuanPanel statusFilter={pengajuanStatus} />
        </div>
      ) : mode === "tanggal" ? (
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
          {canApprove && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Pengajuan Izin/Sakit/Cuti</h3>
                <PengajuanBulananExport bulan={bulan} rows={pengajuanBulananRows} />
              </div>
              <DataTable
                columns={pengajuanBulananColumns}
                rows={pengajuanBulananRows}
                getRowId={(r) => r.pengajuanId}
                isFiltered={!!q}
                empty="Tidak ada pengajuan izin/sakit/cuti bulan ini."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
