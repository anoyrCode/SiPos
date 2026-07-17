import { Fingerprint } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import { PageHeader } from "@/components/shared/page-header";
import {
  computeDayStatusList,
  combineSesiStatuses,
  effectiveTanggalMulai,
  resolveJadwalHari,
  type JadwalPegawai,
  type SesiStatus,
} from "@/lib/absensi-status";
import { AbsensiClient, type AbsensiHistoryRow } from "./absensi-client";
import { getOpenSession } from "./actions";
import { PengajuanList, type PengajuanRow } from "./pengajuan-list";

/**
 * Tanggal 1 s.d. hari ini di bulan berjalan (Asia/Jakarta), urutan terbaru
 * dulu, dibatasi `tanggalMulai` (tanggal sistem absensi mulai dipakai,
 * diatur admin) bila diisi — supaya riwayat sebelum go-live (data uji coba)
 * tidak ikut ditampilkan.
 */
function datesThisMonthJakarta(tanggalMulai: string | null): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
  const todayStr = fmt.format(new Date());
  // Hari ini selalu tetap muncul walau belum lewat tanggalMulai (mis. diakses sehari sebelum go-live).
  const cutoff = tanggalMulai && tanggalMulai <= todayStr ? tanggalMulai : null;
  const [y, m, dStr] = todayStr.split("-");
  const dayOfMonth = Number(dStr);
  const dates: string[] = [];
  for (let d = dayOfMonth; d >= 1; d--) {
    const tanggal = `${y}-${m}-${String(d).padStart(2, "0")}`;
    if (cutoff && tanggal < cutoff) break;
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

  const [{ data: pegawai }, { data: jadwalHarianRows }, { data: jadwalSementaraRows }] =
    await Promise.all([
      supabase
        .from("pegawai")
        .select(
          "jam_masuk_jadwal, jam_pulang_jadwal, hari_libur, jadwal_fleksibel, jadwal_harian_berbeda, shift_ganda, jam_masuk_jadwal_2, jam_pulang_jadwal_2, tanggal_mulai_absensi, bebas_lokasi",
        )
        .eq("id", pegawaiId)
        .maybeSingle(),
      supabase
        .from("pegawai_jadwal_harian")
        .select("hari, jam_masuk, jam_pulang")
        .eq("pegawai_id", pegawaiId),
      supabase
        .from("pegawai_jadwal_sementara")
        .select("tanggal_mulai, tanggal_selesai, jam_masuk, jam_pulang")
        .eq("pegawai_id", pegawaiId),
    ]);

  const jadwalHarian: Record<
    number,
    { jam_masuk: string | null; jam_pulang: string | null }
  > = {};
  for (const r of jadwalHarianRows ?? []) {
    jadwalHarian[r.hari] = { jam_masuk: r.jam_masuk, jam_pulang: r.jam_pulang };
  }

  const jadwalSementara = jadwalSementaraRows ?? [];
  const jadwal: JadwalPegawai = {
    jam_masuk_jadwal: pegawai?.jam_masuk_jadwal ?? null,
    jam_pulang_jadwal: pegawai?.jam_pulang_jadwal ?? null,
    hari_libur: pegawai?.hari_libur ?? null,
    jadwal_harian: pegawai?.jadwal_harian_berbeda ? jadwalHarian : null,
    jadwal_sementara: jadwalSementara,
  };
  const shiftGanda = !!pegawai?.shift_ganda;
  const jadwalSesi2: JadwalPegawai = {
    jam_masuk_jadwal: pegawai?.jam_masuk_jadwal_2 ?? null,
    jam_pulang_jadwal: pegawai?.jam_pulang_jadwal_2 ?? null,
    hari_libur: pegawai?.hari_libur ?? null,
    jadwal_harian: null,
    jadwal_sementara: jadwalSementara,
  };

  const { data: setting } = await supabase
    .from("absensi_pengaturan")
    .select("lokasi_lat, lokasi_long, radius_meter, toleransi_menit, tanggal_mulai")
    .limit(1)
    .maybeSingle();
  const tanggalMulai = effectiveTanggalMulai(
    setting?.tanggal_mulai ?? null,
    pegawai?.tanggal_mulai_absensi ?? null,
  );

  const dates = datesThisMonthJakarta(tanggalMulai);
  const from = dates[dates.length - 1];
  const to = dates[0];

  const [{ data: rows }, { data: pengajuanRows }, { data: liburKhususRows }] =
    await Promise.all([
      supabase
        .from("absensi")
        .select(
          "tanggal, jam_masuk_aktual, jam_pulang_aktual, jam_masuk_aktual_2, jam_pulang_aktual_2, kategori_absen",
        )
        .eq("pegawai_id", pegawaiId)
        .gte("tanggal", from)
        .lte("tanggal", to),
      supabase
        .from("absensi_pengajuan")
        .select("id, kategori, tanggal_mulai, tanggal_selesai, status, alasan_penolakan")
        .eq("pegawai_id", pegawaiId)
        .order("created_at", { ascending: false }),
      supabase.from("libur_khusus").select("tanggal"),
    ]);

  const toleransiMenit = setting?.toleransi_menit ?? 0;
  const liburKhususSet = new Set((liburKhususRows ?? []).map((l) => l.tanggal));
  const rowMap = new Map((rows ?? []).map((r) => [r.tanggal, r]));

  const history: AbsensiHistoryRow[] = dates.map((tanggal) => {
    const record = rowMap.get(tanggal) ?? null;
    const statuses = computeDayStatusList(
      tanggal,
      record,
      jadwal,
      toleransiMenit,
      liburKhususSet,
      tanggalMulai,
    );
    let sesiStatuses: SesiStatus[];
    if (shiftGanda) {
      const record2 = record
        ? {
            jam_masuk_aktual: record.jam_masuk_aktual_2,
            jam_pulang_aktual: record.jam_pulang_aktual_2,
            kategori_absen: record.kategori_absen,
          }
        : null;
      const statusesSesi2 = computeDayStatusList(
        tanggal,
        record2,
        jadwalSesi2,
        toleransiMenit,
        liburKhususSet,
        tanggalMulai,
      );
      sesiStatuses = combineSesiStatuses(statuses, statusesSesi2);
    } else {
      sesiStatuses = statuses.map((s) => ({ sesi: 1 as const, status: s }));
    }
    return {
      tanggal,
      jamMasukAktual: record?.jam_masuk_aktual ?? null,
      jamPulangAktual: record?.jam_pulang_aktual ?? null,
      jamMasukAktual2: record?.jam_masuk_aktual_2 ?? null,
      jamPulangAktual2: record?.jam_pulang_aktual_2 ?? null,
      statuses,
      sesiStatuses,
    };
  });

  // Sesi terbuka (belum clock out) menang atas baris tanggal-hari-ini biasa —
  // shift yang melewati tengah malam (mis. masuk 21:00, pulang 05:00 besok)
  // tersimpan di bawah tanggal MULAI-nya, bukan tanggal hari ini.
  const openSession = await getOpenSession(pegawaiId, 1);
  const rowHariIni = rowMap.get(to) ?? null;
  const jamMasukHariIni =
    openSession?.jam_masuk_aktual ?? rowHariIni?.jam_masuk_aktual ?? null;
  const jamPulangHariIni =
    openSession?.jam_pulang_aktual ?? rowHariIni?.jam_pulang_aktual ?? null;

  let jamMasukHariIni2: string | null = null;
  let jamPulangHariIni2: string | null = null;
  if (shiftGanda) {
    const openSession2 = await getOpenSession(pegawaiId, 2);
    jamMasukHariIni2 =
      openSession2?.jam_masuk_aktual ?? rowHariIni?.jam_masuk_aktual_2 ?? null;
    jamPulangHariIni2 =
      openSession2?.jam_pulang_aktual ?? rowHariIni?.jam_pulang_aktual_2 ?? null;
  }

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
          !!pegawai?.jadwal_fleksibel ||
          !!pegawai?.jadwal_harian_berbeda ||
          shiftGanda
        }
        jadwalFleksibel={!!pegawai?.jadwal_fleksibel}
        shiftGanda={shiftGanda}
        jamMasukJadwal={formatJamJadwal(resolveJadwalHari(to, jadwal).jam_masuk_jadwal)}
        jamPulangJadwal={formatJamJadwal(resolveJadwalHari(to, jadwal).jam_pulang_jadwal)}
        jamMasukJadwal2={formatJamJadwal(jadwalSesi2.jam_masuk_jadwal)}
        jamPulangJadwal2={formatJamJadwal(jadwalSesi2.jam_pulang_jadwal)}
        jamMasukAktual={jamMasukHariIni}
        jamPulangAktual={jamPulangHariIni}
        jamMasukAktual2={jamMasukHariIni2}
        jamPulangAktual2={jamPulangHariIni2}
        todayStatuses={history[0].statuses}
        todaySesiStatuses={history[0].sesiStatuses}
        history={history}
        lokasiLat={setting?.lokasi_lat ?? null}
        lokasiLong={setting?.lokasi_long ?? null}
        radiusMeter={setting?.radius_meter ?? null}
        bebasLokasi={!!pegawai?.bebas_lokasi}
      />
      <PengajuanList items={pengajuanList} />
    </div>
  );
}
