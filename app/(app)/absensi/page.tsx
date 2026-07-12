import { Fingerprint } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import { PageHeader } from "@/components/shared/page-header";
import { computeDayStatus, type JadwalPegawai } from "@/lib/absensi-status";
import { AbsensiClient, type AbsensiHistoryRow } from "./absensi-client";
import { PengajuanList, type PengajuanRow } from "./pengajuan-list";

/** Tanggal mulai project dipakai produksi — riwayat sebelum ini tidak ditampilkan (data uji coba). */
const LAUNCH_DATE = "2026-07-11";

/** Tanggal 1 s.d. hari ini di bulan berjalan (Asia/Jakarta), urutan terbaru dulu, dibatasi LAUNCH_DATE. */
function datesThisMonthJakarta(): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
  const todayStr = fmt.format(new Date());
  // Hari ini selalu tetap muncul walau belum lewat LAUNCH_DATE (mis. diakses sehari sebelum go-live).
  const cutoff = LAUNCH_DATE > todayStr ? todayStr : LAUNCH_DATE;
  const [y, m, dStr] = todayStr.split("-");
  const dayOfMonth = Number(dStr);
  const dates: string[] = [];
  for (let d = dayOfMonth; d >= 1; d--) {
    const tanggal = `${y}-${m}-${String(d).padStart(2, "0")}`;
    if (tanggal < cutoff) break;
    dates.push(tanggal);
  }
  return dates;
}

/** "HH:MM:SS" (kolom Postgres `time`) -> "HH:MM". Bukan timestamptz, jangan pakai formatJamWIB. */
function formatJamJadwal(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

export default async function Page() {
  const profile = await requirePerm("absensi");
  const supabase = await createClient();
  const pegawaiId = profile.pegawai_id ?? "";

  const { data: pegawai } = await supabase
    .from("pegawai")
    .select("jam_masuk_jadwal, jam_pulang_jadwal, hari_libur, jadwal_fleksibel")
    .eq("id", pegawaiId)
    .maybeSingle();

  const jadwal: JadwalPegawai = {
    jam_masuk_jadwal: pegawai?.jam_masuk_jadwal ?? null,
    jam_pulang_jadwal: pegawai?.jam_pulang_jadwal ?? null,
    hari_libur: pegawai?.hari_libur ?? null,
  };

  const dates = datesThisMonthJakarta();
  const from = dates[dates.length - 1];
  const to = dates[0];

  const [{ data: rows }, { data: setting }, { data: pengajuanRows }] = await Promise.all([
    supabase
      .from("absensi")
      .select("tanggal, jam_masuk_aktual, jam_pulang_aktual, kategori_absen")
      .eq("pegawai_id", pegawaiId)
      .gte("tanggal", from)
      .lte("tanggal", to),
    supabase
      .from("absensi_pengaturan")
      .select("lokasi_lat, lokasi_long, radius_meter, toleransi_menit")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("absensi_pengajuan")
      .select("id, kategori, tanggal_mulai, tanggal_selesai, status, alasan_penolakan")
      .eq("pegawai_id", pegawaiId)
      .order("created_at", { ascending: false }),
  ]);

  const toleransiMenit = setting?.toleransi_menit ?? 0;
  const rowMap = new Map((rows ?? []).map((r) => [r.tanggal, r]));

  const history: AbsensiHistoryRow[] = dates.map((tanggal) => {
    const record = rowMap.get(tanggal) ?? null;
    return {
      tanggal,
      jamMasukAktual: record?.jam_masuk_aktual ?? null,
      jamPulangAktual: record?.jam_pulang_aktual ?? null,
      status: computeDayStatus(tanggal, record, jadwal, toleransiMenit),
    };
  });

  const todayRow = rowMap.get(to) ?? null;

  const pengajuanList: PengajuanRow[] = (pengajuanRows ?? []).map((r) => ({
    id: r.id,
    kategori: r.kategori as PengajuanRow["kategori"],
    tanggalMulai: r.tanggal_mulai,
    tanggalSelesai: r.tanggal_selesai,
    status: r.status as PengajuanRow["status"],
    alasanPenolakan: r.alasan_penolakan,
  }));

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={Fingerprint}
        title="Absensi"
        description="Clock in/out kehadiran harian berdasarkan lokasi pondok."
      />
      <AbsensiClient
        hasJadwal={
          (!!jadwal.jam_masuk_jadwal && !!jadwal.jam_pulang_jadwal) ||
          !!pegawai?.jadwal_fleksibel
        }
        jadwalFleksibel={!!pegawai?.jadwal_fleksibel}
        jamMasukJadwal={formatJamJadwal(jadwal.jam_masuk_jadwal)}
        jamPulangJadwal={formatJamJadwal(jadwal.jam_pulang_jadwal)}
        jamMasukAktual={todayRow?.jam_masuk_aktual ?? null}
        jamPulangAktual={todayRow?.jam_pulang_aktual ?? null}
        todayStatus={history[0].status}
        history={history}
        lokasiLat={setting?.lokasi_lat ?? null}
        lokasiLong={setting?.lokasi_long ?? null}
        radiusMeter={setting?.radius_meter ?? null}
      />
      <PengajuanList items={pengajuanList} />
    </div>
  );
}
