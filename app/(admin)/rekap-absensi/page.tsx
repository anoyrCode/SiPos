import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRekapAbsensiAkses } from "@/lib/auth/dal";
import { getStr, paginateArray, parsePageParamsNamed, type SearchParams } from "@/lib/list-params";
import { formatDateID } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeDayStatus,
  computeStatusMasuk,
  computeStatusPulang,
  computeMenitTelatMasuk,
  computeMenitLebihAwalPulang,
  isHariLiburPegawai,
  resolveJadwalHari,
  todayJakarta,
  STATUS_LABEL,
  formatJamWIB,
  type AbsensiStatus,
  type PengajuanStatus,
  PENGAJUAN_STATUS_LABEL,
} from "@/lib/absensi-status";
import { DateFilter } from "./date-filter";
import { RentangFilter } from "./rentang-filter";
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
  overrideLokasi: boolean;
  overrideAlasan: string | null;
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
  belum_mulai: "outline",
};

/** "HH:MM:SS" (kolom Postgres `time`) -> "HH:MM". Bukan timestamptz, jangan pakai formatJamWIB. */
function formatJamJadwal(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

const MAX_RENTANG_HARI = 62;

/** Awal & akhir bulan berjalan (Asia/Jakarta), dipakai sbg default rentang. */
function currentMonthBounds(): { dari: string; sampai: string } {
  const [yStr, mStr] = todayJakarta().split("-");
  const lastDay = new Date(Number(yStr), Number(mStr), 0).getDate();
  return {
    dari: `${yStr}-${mStr}-01`,
    sampai: `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Semua tanggal "YYYY-MM-DD" dari dari s.d. sampai (inklusif), dibatasi MAX_RENTANG_HARI. */
function datesInRange(dari: string, sampai: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${dari}T00:00:00`);
  const end = new Date(`${sampai}T00:00:00`);
  while (cur <= end && dates.length < MAX_RENTANG_HARI) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
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
  const persetujuanParams = parsePageParamsNamed(sp, "page", "perPage");
  const tanggal = getStr(sp.tanggal) || todayJakarta();
  const defaultBounds = currentMonthBounds();
  const dari = getStr(sp.dari) || defaultBounds.dari;
  const sampaiRaw = getStr(sp.sampai) || defaultBounds.sampai;
  const sampai = sampaiRaw < dari ? dari : sampaiRaw;
  const q = getStr(sp.q);
  const statusFilter = getStr(sp.status);
  const rangeDates = mode === "bulanan" ? datesInRange(dari, sampai) : [];
  const isRangeClamped =
    rangeDates.length > 0 && rangeDates[rangeDates.length - 1] < sampai;

  if (!canViewRekap) {
    // Approver tanpa akses rekap (perm_master/perm_rekap_absensi): skip semua
    // query rekap tanggal/bulanan (data GPS & jam kerja SEMUA pegawai),
    // langsung ke tampilan Persetujuan saja.
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader
          icon={ClipboardCheck}
          title="Persetujuan Absensi"
          description="Setujui atau tolak pengajuan izin/sakit pegawai."
        />
        <PengajuanStatusFilter value={pengajuanStatus} />
        <PersetujuanPanel
          statusFilter={pengajuanStatus}
          page={persetujuanParams.page}
          perPage={persetujuanParams.perPage}
        />
      </div>
    );
  }

  const supabase = await createClient();

  let pegawaiQuery = supabase
    .from("pegawai")
    .select(
      "id, nama, jam_masuk_jadwal, jam_pulang_jadwal, hari_libur, jadwal_harian_berbeda",
    )
    .order("nama");
  if (q) {
    const term = q.replace(/[,()*%_]/g, " ").trim();
    if (term) pegawaiQuery = pegawaiQuery.ilike("nama", `%${term}%`);
  }

  const absensiQuery =
    mode === "bulanan"
      ? supabase
          .from("absensi")
          .select(
            "pegawai_id, tanggal, jam_masuk_aktual, jam_pulang_aktual, kategori_absen, override_lokasi, override_alasan",
          )
          .gte("tanggal", rangeDates[0])
          .lte("tanggal", rangeDates[rangeDates.length - 1])
      : supabase
          .from("absensi")
          .select(
            "pegawai_id, tanggal, jam_masuk_aktual, jam_pulang_aktual, kategori_absen, override_lokasi, override_alasan",
          )
          .eq("tanggal", tanggal);

  const [
    { data: pegawaiList },
    { data: absensiRows },
    { data: setting },
    { data: liburKhususRows },
    { data: jadwalHarianRows },
  ] = await Promise.all([
    pegawaiQuery,
    absensiQuery,
    supabase
      .from("absensi_pengaturan")
      .select("lokasi_lat, lokasi_long, radius_meter, toleransi_menit, tanggal_mulai")
      .limit(1)
      .maybeSingle(),
    supabase.from("libur_khusus").select("tanggal, keterangan").order("tanggal"),
    supabase
      .from("pegawai_jadwal_harian")
      .select("pegawai_id, hari, jam_masuk, jam_pulang"),
  ]);

  const jadwalHarianMap = new Map<
    string,
    Record<number, { jam_masuk: string | null; jam_pulang: string | null }>
  >();
  for (const r of jadwalHarianRows ?? []) {
    const entry = jadwalHarianMap.get(r.pegawai_id) ?? {};
    entry[r.hari] = { jam_masuk: r.jam_masuk, jam_pulang: r.jam_pulang };
    jadwalHarianMap.set(r.pegawai_id, entry);
  }

  const toleransiMenit = setting?.toleransi_menit ?? 0;
  const tanggalMulai = setting?.tanggal_mulai ?? null;
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
      jadwal_harian: p.jadwal_harian_berbeda
        ? (jadwalHarianMap.get(p.id) ?? null)
        : null,
    };
    return {
      pegawaiId: p.id,
      nama: p.nama,
      jamMasukAktual: record?.jam_masuk_aktual ?? null,
      jamPulangAktual: record?.jam_pulang_aktual ?? null,
      status: computeDayStatus(
        tanggal,
        record,
        jadwal,
        toleransiMenit,
        liburKhususSet,
        tanggalMulai,
      ),
      overrideLokasi: record?.override_lokasi ?? false,
      overrideAlasan: record?.override_alasan ?? null,
    };
  });

  const isStatusFilterActive =
    !!statusFilter && Object.hasOwn(STATUS_LABEL, statusFilter);
  const rows: Row[] = isStatusFilterActive
    ? allRows.filter((r) => r.status === statusFilter)
    : allRows;
  const { page, perPage } = parsePageParamsNamed(sp, "page", "perPage");
  const pagedRows = paginateArray(rows, page, perPage);

  const telatMasukRows: TelatMasukRow[] = [];
  const telatKeluarRows: TelatKeluarRow[] = [];
  const curangRows: CurangRow[] = [];

  if (mode === "bulanan") {
    for (const p of pegawaiList ?? []) {
      const jadwal = {
        jam_masuk_jadwal: p.jam_masuk_jadwal,
        jam_pulang_jadwal: p.jam_pulang_jadwal,
        hari_libur: p.hari_libur,
        jadwal_harian: p.jadwal_harian_berbeda
          ? (jadwalHarianMap.get(p.id) ?? null)
          : null,
      };
      for (const tgl of rangeDates) {
        if (tanggalMulai && tgl < tanggalMulai) continue;
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
            jamPulangJadwal: formatJamJadwal(
              resolveJadwalHari(tgl, jadwal).jam_pulang_jadwal,
            ),
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
      .lte("tanggal_mulai", rangeDates[rangeDates.length - 1])
      .gte("tanggal_selesai", rangeDates[0])
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

  const masukParams = parsePageParamsNamed(sp, "masukPage", "masukPerPage");
  const keluarParams = parsePageParamsNamed(sp, "keluarPage", "keluarPerPage");
  const curangParams = parsePageParamsNamed(sp, "curangPage", "curangPerPage");
  const pengajuanParams = parsePageParamsNamed(sp, "pengajuanPage", "pengajuanPerPage");
  const pagedTelatMasuk = paginateArray(telatMasukRows, masukParams.page, masukParams.perPage);
  const pagedTelatKeluar = paginateArray(telatKeluarRows, keluarParams.page, keluarParams.perPage);
  const pagedCurang = paginateArray(curangRows, curangParams.page, curangParams.perPage);
  const pagedPengajuanBulanan = paginateArray(
    pengajuanBulananRows,
    pengajuanParams.page,
    pengajuanParams.perPage,
  );

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
          {r.kategori === "izin" ? "Izin" : "Sakit"}
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
    {
      key: "lokasi",
      header: "Lokasi",
      cell: (r) =>
        r.overrideLokasi ? (
          <Badge variant="warning" title={r.overrideAlasan ?? undefined}>
            Manual — di luar radius
          </Badge>
        ) : null,
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
      header: "Terlambat (menit)",
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
        description="Rekap kehadiran seluruh pegawai per tanggal atau per rentang tanggal."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {mode === "tanggal" ? (
            <DateFilter value={tanggal} />
          ) : (
            <RentangFilter dari={dari} sampai={sampai} />
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
              <Link href="/rekap-absensi?mode=bulanan">Per Rentang</Link>
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
          {canViewRekap && (
            <>
              <PengaturanAbsensiForm
                initial={{
                  lokasi_lat: setting?.lokasi_lat ?? null,
                  lokasi_long: setting?.lokasi_long ?? null,
                  radius_meter: setting?.radius_meter ?? 150,
                  toleransi_menit: toleransiMenit,
                  tanggal_mulai: tanggalMulai,
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
          <PersetujuanPanel
            statusFilter={pengajuanStatus}
            page={persetujuanParams.page}
            perPage={persetujuanParams.perPage}
          />
        </div>
      ) : mode === "tanggal" ? (
        <div className="space-y-3">
          <DataTable
            columns={columns}
            rows={pagedRows.rows}
            getRowId={(r) => r.pegawaiId}
            isFiltered={!!q || isStatusFilterActive}
            empty="Belum ada data pegawai."
          />
          <Pagination
            page={pagedRows.page}
            perPage={perPage}
            totalPages={pagedRows.totalPages}
            totalItems={pagedRows.totalItems}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                Rekap keterlambatan {formatDateID(rangeDates[0])} –{" "}
                {formatDateID(rangeDates[rangeDates.length - 1])}
              </h2>
              {isRangeClamped && (
                <p className="text-xs text-muted-foreground">
                  Rentang dibatasi maks {MAX_RENTANG_HARI} hari.
                </p>
              )}
            </div>
            <KeterlambatanExport
              dari={rangeDates[0]}
              sampai={rangeDates[rangeDates.length - 1]}
              telatMasuk={telatMasukRows}
              telatKeluar={telatKeluarRows}
              curang={curangRows}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Terlambat Clock In</h3>
            <DataTable
              columns={telatMasukColumns}
              rows={pagedTelatMasuk.rows}
              getRowId={(r) => `${r.pegawaiId}_${r.tanggal}`}
              isFiltered={!!q}
              empty="Tidak ada keterlambatan clock in pada rentang ini."
            />
            <Pagination
              page={pagedTelatMasuk.page}
              perPage={masukParams.perPage}
              totalPages={pagedTelatMasuk.totalPages}
              totalItems={pagedTelatMasuk.totalItems}
              pageParam="masukPage"
              perPageParam="masukPerPage"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Terlambat Clock Out</h3>
            <DataTable
              columns={telatKeluarColumns}
              rows={pagedTelatKeluar.rows}
              getRowId={(r) => `${r.pegawaiId}_${r.tanggal}`}
              isFiltered={!!q}
              empty="Tidak ada keterlambatan clock out pada rentang ini."
            />
            <Pagination
              page={pagedTelatKeluar.page}
              perPage={keluarParams.perPage}
              totalPages={pagedTelatKeluar.totalPages}
              totalItems={pagedTelatKeluar.totalItems}
              pageParam="keluarPage"
              perPageParam="keluarPerPage"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Pulang Sebelum Waktunya</h3>
            <DataTable
              columns={curangColumns}
              rows={pagedCurang.rows}
              getRowId={(r) => `${r.pegawaiId}_${r.tanggal}`}
              isFiltered={!!q}
              empty="Tidak ada kejadian pulang sebelum waktunya pada rentang ini."
            />
            <Pagination
              page={pagedCurang.page}
              perPage={curangParams.perPage}
              totalPages={pagedCurang.totalPages}
              totalItems={pagedCurang.totalItems}
              pageParam="curangPage"
              perPageParam="curangPerPage"
            />
          </div>
          {canApprove && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Pengajuan Izin/Sakit</h3>
                <PengajuanBulananExport
                  dari={rangeDates[0]}
                  sampai={rangeDates[rangeDates.length - 1]}
                  rows={pengajuanBulananRows}
                />
              </div>
              <DataTable
                columns={pengajuanBulananColumns}
                rows={pagedPengajuanBulanan.rows}
                getRowId={(r) => r.pengajuanId}
                isFiltered={!!q}
                empty="Tidak ada pengajuan izin/sakit pada rentang ini."
              />
              <Pagination
                page={pagedPengajuanBulanan.page}
                perPage={pengajuanParams.perPage}
                totalPages={pagedPengajuanBulanan.totalPages}
                totalItems={pagedPengajuanBulanan.totalItems}
                pageParam="pengajuanPage"
                perPageParam="pengajuanPerPage"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
