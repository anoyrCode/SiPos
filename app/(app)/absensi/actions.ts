"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { canAbsensi, getProfile } from "@/lib/auth/dal";
import { haversineDistanceMeters } from "@/lib/geo";
import {
  jadwalPulangInstant,
  resolveJadwalHari,
  todayJakarta,
  type JadwalPegawai,
  type KategoriAbsen,
} from "@/lib/absensi-status";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

/** Hasil clock in/out — beda dari FormResult krn perlu tandai kegagalan geofence secara khusus (utk munculkan modal override di client). */
export type ClockResult =
  | { ok: true }
  | { ok: false; error: string; geofenceFailed?: boolean };

const PATH = "/absensi";

export type OpenSession = {
  id: string;
  tanggal: string;
  sesi: 1 | 2;
  jam_masuk_aktual: string | null;
  jam_pulang_aktual: string | null;
  override_alasan: string | null;
};

const SESI_TERBUKA_BUFFER_JAM = 8;
const SESI_TERBUKA_FALLBACK_JAM = 16;

/**
 * Sesi absensi yang masih terbuka (sudah clock in, belum clock out) utk 1
 * pegawai & 1 sesi (1 = sesi tunggal/Sesi 1, 2 = Sesi 2 utk pegawai
 * shift-ganda) — dicari TANPA filter tanggal, supaya shift yang melewati
 * tengah malam (mis. masuk 21:00, pulang 05:00 besok) tetap terdeteksi
 * setelah lewat pergantian hari, bukan cuma dicocokkan ke "tanggal = hari
 * ini".
 *
 * Sesi yang sudah lewat (jadwal pulang + 8 jam) dianggap EXPIRED — pegawai
 * kemungkinan lupa clock out — dan dikembalikan null supaya tidak
 * memblokir clock-in baru selamanya. Baris lama dibiarkan apa adanya
 * (tetap kelihatan "Belum Clock Out" di Rekap Absensi admin). Utk pegawai
 * tanpa patokan jadwal pulang di hari itu (Jadwal Fleksibel / hari kosong
 * di jadwal beda-per-hari / Sesi 2 tanpa jadwal diisi), fallback pakai
 * flat 16 jam dari jam clock-in.
 */
export async function getOpenSession(
  pegawaiId: string,
  sesi: 1 | 2 = 1,
): Promise<OpenSession | null> {
  const supabase = await createClient();

  if (sesi === 2) {
    const { data: row } = await supabase
      .from("absensi")
      .select("id, tanggal, jam_masuk_aktual_2, jam_pulang_aktual_2, override_alasan_2")
      .eq("pegawai_id", pegawaiId)
      .not("jam_masuk_aktual_2", "is", null)
      .is("jam_pulang_aktual_2", null)
      .order("tanggal", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row?.jam_masuk_aktual_2) return null;

    const { data: pegawai } = await supabase
      .from("pegawai")
      .select("jam_masuk_jadwal_2, jam_pulang_jadwal_2")
      .eq("id", pegawaiId)
      .maybeSingle();

    const cutoff = pegawai?.jam_pulang_jadwal_2
      ? new Date(
          jadwalPulangInstant(
            row.tanggal,
            pegawai.jam_masuk_jadwal_2,
            pegawai.jam_pulang_jadwal_2,
          ).getTime() +
            SESI_TERBUKA_BUFFER_JAM * 60 * 60 * 1000,
        )
      : new Date(
          new Date(row.jam_masuk_aktual_2).getTime() +
            SESI_TERBUKA_FALLBACK_JAM * 60 * 60 * 1000,
        );

    if (new Date() > cutoff) return null;
    return {
      id: row.id,
      tanggal: row.tanggal,
      sesi: 2,
      jam_masuk_aktual: row.jam_masuk_aktual_2,
      jam_pulang_aktual: row.jam_pulang_aktual_2,
      override_alasan: row.override_alasan_2,
    };
  }

  const { data: row } = await supabase
    .from("absensi")
    .select("id, tanggal, jam_masuk_aktual, jam_pulang_aktual, override_alasan")
    .eq("pegawai_id", pegawaiId)
    .not("jam_masuk_aktual", "is", null)
    .is("jam_pulang_aktual", null)
    .order("tanggal", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row?.jam_masuk_aktual) return null;

  const [{ data: pegawai }, { data: jadwalHarianRows }] = await Promise.all([
    supabase
      .from("pegawai")
      .select("jam_masuk_jadwal, jam_pulang_jadwal, jadwal_harian_berbeda")
      .eq("id", pegawaiId)
      .maybeSingle(),
    supabase
      .from("pegawai_jadwal_harian")
      .select("hari, jam_masuk, jam_pulang")
      .eq("pegawai_id", pegawaiId),
  ]);
  const jadwalHarian: Record<
    number,
    { jam_masuk: string | null; jam_pulang: string | null }
  > = {};
  for (const r of jadwalHarianRows ?? []) {
    jadwalHarian[r.hari] = { jam_masuk: r.jam_masuk, jam_pulang: r.jam_pulang };
  }
  const jadwal: JadwalPegawai = {
    jam_masuk_jadwal: pegawai?.jam_masuk_jadwal ?? null,
    jam_pulang_jadwal: pegawai?.jam_pulang_jadwal ?? null,
    hari_libur: null,
    jadwal_harian: pegawai?.jadwal_harian_berbeda ? jadwalHarian : null,
  };
  const { jam_masuk_jadwal, jam_pulang_jadwal } = resolveJadwalHari(
    row.tanggal,
    jadwal,
  );

  const cutoff = jam_pulang_jadwal
    ? new Date(
        jadwalPulangInstant(row.tanggal, jam_masuk_jadwal, jam_pulang_jadwal).getTime() +
          SESI_TERBUKA_BUFFER_JAM * 60 * 60 * 1000,
      )
    : new Date(
        new Date(row.jam_masuk_aktual).getTime() +
          SESI_TERBUKA_FALLBACK_JAM * 60 * 60 * 1000,
      );

  if (new Date() > cutoff) return null;
  return {
    id: row.id,
    tanggal: row.tanggal,
    sesi: 1,
    jam_masuk_aktual: row.jam_masuk_aktual,
    jam_pulang_aktual: row.jam_pulang_aktual,
    override_alasan: row.override_alasan,
  };
}
const KATEGORI_VALID: KategoriAbsen[] = ["izin", "sakit"];

/** Semua tanggal "YYYY-MM-DD" dari start s.d. end (inklusif), maks 31 hari. */
function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let guard = 0;
  while (cur <= last && guard < 31) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return dates;
}

async function checkGeofence(lat: number, long: number): Promise<string | null> {
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("absensi_pengaturan")
    .select("lokasi_lat, lokasi_long, radius_meter")
    .limit(1)
    .maybeSingle();
  if (!setting || setting.lokasi_lat == null || setting.lokasi_long == null) {
    return "Lokasi pondok belum diatur admin.";
  }
  const distance = haversineDistanceMeters(
    lat,
    long,
    setting.lokasi_lat,
    setting.lokasi_long,
  );
  if (distance > setting.radius_meter) {
    return `Di luar area pondok (jarak ${Math.round(distance)}m, radius ${setting.radius_meter}m).`;
  }
  return null;
}

export async function clockIn(
  lat: number,
  long: number,
  override = false,
  alasan = "",
  sesi: 1 | 2 = 1,
): Promise<ClockResult> {
  if (!(await canAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak tertaut ke data pegawai." };
  }

  const supabase = await createClient();
  const { data: pegawai } = await supabase
    .from("pegawai")
    .select(
      "jam_masuk_jadwal, jadwal_fleksibel, jadwal_harian_berbeda, shift_ganda, bebas_lokasi",
    )
    .eq("id", profile.pegawai_id)
    .maybeSingle();
  const sesiEfektif: 1 | 2 = pegawai?.shift_ganda ? sesi : 1;

  const geofenceError = pegawai?.bebas_lokasi ? null : await checkGeofence(lat, long);
  if (geofenceError && !override) {
    return { ok: false, error: geofenceError, geofenceFailed: true };
  }
  if (geofenceError && !alasan.trim()) {
    return { ok: false, error: "Alasan wajib diisi untuk clock in di luar radius." };
  }

  if (
    !pegawai?.jam_masuk_jadwal &&
    !pegawai?.jadwal_fleksibel &&
    !pegawai?.jadwal_harian_berbeda &&
    !pegawai?.shift_ganda
  ) {
    return { ok: false, error: "Jadwal absensi belum diatur, hubungi admin." };
  }

  const openSession = await getOpenSession(profile.pegawai_id, sesiEfektif);
  if (openSession) {
    return {
      ok: false,
      error: `Anda masih dalam sesi kerja (Sesi ${sesiEfektif}) sejak ${openSession.tanggal} (belum clock out).`,
    };
  }

  const tanggal = todayJakarta();
  const { data: existing } = await supabase
    .from("absensi")
    .select("id, jam_masuk_aktual, jam_masuk_aktual_2, kategori_absen")
    .eq("pegawai_id", profile.pegawai_id)
    .eq("tanggal", tanggal)
    .maybeSingle();
  if (existing?.kategori_absen) {
    return {
      ok: false,
      error: "Anda sudah mengajukan izin/sakit hari ini. Hubungi admin bila ingin membatalkan pengajuan.",
    };
  }
  const sudahClockIn =
    sesiEfektif === 1 ? existing?.jam_masuk_aktual : existing?.jam_masuk_aktual_2;
  if (sudahClockIn) {
    return { ok: false, error: `Sudah clock in Sesi ${sesiEfektif} hari ini.` };
  }

  const payload =
    sesiEfektif === 1
      ? {
          jam_masuk_aktual: new Date().toISOString(),
          lokasi_masuk_lat: lat,
          lokasi_masuk_long: long,
          override_lokasi: !!geofenceError,
          override_alasan: geofenceError ? alasan.trim() : null,
        }
      : {
          jam_masuk_aktual_2: new Date().toISOString(),
          lokasi_masuk_2_lat: lat,
          lokasi_masuk_2_long: long,
          override_lokasi_2: !!geofenceError,
          override_alasan_2: geofenceError ? alasan.trim() : null,
        };

  if (existing) {
    const { error } = await supabase.from("absensi").update(payload).eq("id", existing.id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
  } else {
    const { error } = await supabase
      .from("absensi")
      .insert({ pegawai_id: profile.pegawai_id, tanggal, ...payload });
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }

  revalidatePath(PATH);
  return { ok: true };
}

const MAX_BUKTI_BYTES = 5 * 1024 * 1024;
const ALLOWED_BUKTI_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  return "jpg";
}

/** Ajukan izin/sakit sendiri (approval oleh HRD/admin) utk 1 hari/rentang. */
export async function ajukanIzin(formData: FormData): Promise<FormResult> {
  if (!(await canAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak tertaut ke data pegawai." };
  }

  const kategori = String(formData.get("kategori") ?? "");
  const tanggalMulai = String(formData.get("tanggal_mulai") ?? "");
  const tanggalSelesai = String(formData.get("tanggal_selesai") ?? "");
  const keterangan = String(formData.get("keterangan") ?? "");
  const bukti = formData.get("bukti");
  const file = bukti instanceof File && bukti.size > 0 ? bukti : null;

  if (!KATEGORI_VALID.includes(kategori as KategoriAbsen)) {
    return { ok: false, error: "Kategori tidak valid." };
  }
  if (!tanggalMulai || !tanggalSelesai) {
    return { ok: false, error: "Tanggal wajib diisi." };
  }
  if (tanggalSelesai < tanggalMulai) {
    return { ok: false, error: "Tanggal selesai harus sama atau setelah tanggal mulai." };
  }
  if (kategori === "sakit" && !file) {
    return { ok: false, error: "Bukti surat dokter wajib untuk kategori Sakit." };
  }
  if (file) {
    if (file.size > MAX_BUKTI_BYTES) {
      return { ok: false, error: "Ukuran file bukti maksimal 5MB." };
    }
    if (!ALLOWED_BUKTI_TYPES.includes(file.type)) {
      return { ok: false, error: "Format bukti harus JPG, PNG, atau PDF." };
    }
  }

  const dates = enumerateDates(tanggalMulai, tanggalSelesai);
  if (dates.length === 0 || dates.length > 31) {
    return { ok: false, error: "Rentang tanggal maksimal 31 hari." };
  }

  const supabase = await createClient();
  const { data: existingRows } = await supabase
    .from("absensi")
    .select("tanggal, jam_masuk_aktual, jam_pulang_aktual")
    .eq("pegawai_id", profile.pegawai_id)
    .in("tanggal", dates);
  const conflict = (existingRows ?? []).find(
    (r) => r.jam_masuk_aktual || r.jam_pulang_aktual,
  );
  if (conflict) {
    return {
      ok: false,
      error: `Tanggal ${conflict.tanggal} sudah ada data clock in/out, tidak bisa ditimpa.`,
    };
  }

  let buktiPath: string | null = null;
  if (file) {
    buktiPath = `${profile.pegawai_id}/${randomUUID()}.${extFromMime(file.type)}`;
    const { error: uploadErr } = await supabase.storage
      .from("bukti-absensi")
      .upload(buktiPath, file, { contentType: file.type });
    if (uploadErr) {
      return { ok: false, error: "Gagal upload bukti. Coba lagi." };
    }
  }

  const { data: pengajuan, error: pengajuanErr } = await supabase
    .from("absensi_pengajuan")
    .insert({
      pegawai_id: profile.pegawai_id,
      kategori,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      keterangan: keterangan || null,
      bukti_url: buktiPath,
    })
    .select("id")
    .single();
  if (pengajuanErr || !pengajuan) {
    return { ok: false, error: dbErrorMessage(pengajuanErr) };
  }

  const rows = dates.map((tanggal) => ({
    pegawai_id: profile.pegawai_id,
    tanggal,
    kategori_absen: kategori as KategoriAbsen,
    keterangan: keterangan || null,
    pengajuan_id: pengajuan.id,
  }));
  const { error } = await supabase
    .from("absensi")
    .upsert(rows, { onConflict: "pegawai_id,tanggal" });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function clockOut(
  lat: number,
  long: number,
  override = false,
  alasan = "",
  sesi: 1 | 2 = 1,
): Promise<ClockResult> {
  if (!(await canAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak tertaut ke data pegawai." };
  }

  const supabase = await createClient();
  const { data: pegawai } = await supabase
    .from("pegawai")
    .select("shift_ganda, bebas_lokasi")
    .eq("id", profile.pegawai_id)
    .maybeSingle();
  const sesiEfektif: 1 | 2 = pegawai?.shift_ganda ? sesi : 1;

  const geofenceError = pegawai?.bebas_lokasi ? null : await checkGeofence(lat, long);
  if (geofenceError && !override) {
    return { ok: false, error: geofenceError, geofenceFailed: true };
  }
  if (geofenceError && !alasan.trim()) {
    return { ok: false, error: "Alasan wajib diisi untuk clock out di luar radius." };
  }

  const existing = await getOpenSession(profile.pegawai_id, sesiEfektif);
  if (!existing) {
    return { ok: false, error: `Belum clock in Sesi ${sesiEfektif}.` };
  }

  const payload =
    sesiEfektif === 1
      ? {
          jam_pulang_aktual: new Date().toISOString(),
          lokasi_pulang_lat: lat,
          lokasi_pulang_long: long,
          ...(geofenceError
            ? {
                override_lokasi: true,
                override_alasan: existing.override_alasan
                  ? `${existing.override_alasan} | Clock out: ${alasan.trim()}`
                  : alasan.trim(),
              }
            : {}),
        }
      : {
          jam_pulang_aktual_2: new Date().toISOString(),
          lokasi_pulang_2_lat: lat,
          lokasi_pulang_2_long: long,
          ...(geofenceError
            ? {
                override_lokasi_2: true,
                override_alasan_2: existing.override_alasan
                  ? `${existing.override_alasan} | Clock out: ${alasan.trim()}`
                  : alasan.trim(),
              }
            : {}),
        };

  const { error } = await supabase.from("absensi").update(payload).eq("id", existing.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
