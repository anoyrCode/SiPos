import { ClipboardCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import {
  computeDayStatus,
  todayJakarta,
  STATUS_LABEL,
  formatJamWIB,
  type AbsensiStatus,
} from "@/lib/absensi-status";
import { DateFilter } from "./date-filter";
import { PengaturanAbsensiForm } from "./pengaturan-form";

type Row = {
  pegawaiId: string;
  nama: string;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  status: AbsensiStatus;
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
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const tanggal = getStr(sp.tanggal) || todayJakarta();

  const supabase = await createClient();
  const [{ data: pegawaiList }, { data: absensiRows }, { data: setting }] =
    await Promise.all([
      supabase
        .from("pegawai")
        .select("id, nama, jam_masuk_jadwal, jam_pulang_jadwal, hari_libur")
        .order("nama"),
      supabase
        .from("absensi")
        .select("pegawai_id, jam_masuk_aktual, jam_pulang_aktual")
        .eq("tanggal", tanggal),
      supabase
        .from("absensi_pengaturan")
        .select("lokasi_lat, lokasi_long, radius_meter")
        .limit(1)
        .maybeSingle(),
    ]);

  const absensiMap = new Map((absensiRows ?? []).map((r) => [r.pegawai_id, r]));

  const rows: Row[] = (pegawaiList ?? []).map((p) => {
    const record = absensiMap.get(p.id) ?? null;
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

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={ClipboardCheck}
        title="Rekap Absensi"
        description="Rekap kehadiran seluruh pegawai per tanggal."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <DateFilter value={tanggal} />
        <PengaturanAbsensiForm
          initial={{
            lokasi_lat: setting?.lokasi_lat ?? null,
            lokasi_long: setting?.lokasi_long ?? null,
            radius_meter: setting?.radius_meter ?? 150,
          }}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.pegawaiId}
        empty="Belum ada data pegawai."
      />
    </div>
  );
}
