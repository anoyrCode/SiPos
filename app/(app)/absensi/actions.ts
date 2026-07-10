"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canAbsensi, getProfile } from "@/lib/auth/dal";
import { haversineDistanceMeters } from "@/lib/geo";
import { todayJakarta, type KategoriAbsen } from "@/lib/absensi-status";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/absensi";
const KATEGORI_VALID: KategoriAbsen[] = ["izin", "sakit", "cuti"];

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

export async function clockIn(lat: number, long: number): Promise<FormResult> {
  if (!(await canAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak tertaut ke data pegawai." };
  }

  const geofenceError = await checkGeofence(lat, long);
  if (geofenceError) return { ok: false, error: geofenceError };

  const supabase = await createClient();
  const { data: pegawai } = await supabase
    .from("pegawai")
    .select("jam_masuk_jadwal, jadwal_fleksibel")
    .eq("id", profile.pegawai_id)
    .maybeSingle();
  if (!pegawai?.jam_masuk_jadwal && !pegawai?.jadwal_fleksibel) {
    return { ok: false, error: "Jadwal absensi belum diatur, hubungi admin." };
  }

  const tanggal = todayJakarta();
  const { data: existing } = await supabase
    .from("absensi")
    .select("id, jam_masuk_aktual")
    .eq("pegawai_id", profile.pegawai_id)
    .eq("tanggal", tanggal)
    .maybeSingle();
  if (existing?.jam_masuk_aktual) {
    return { ok: false, error: "Sudah clock in hari ini." };
  }

  const { error } = await supabase.from("absensi").insert({
    pegawai_id: profile.pegawai_id,
    tanggal,
    jam_masuk_aktual: new Date().toISOString(),
    lokasi_masuk_lat: lat,
    lokasi_masuk_long: long,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Ajukan izin/sakit/cuti sendiri (tanpa approval) utk 1 hari atau rentang. */
export async function ajukanIzin(input: {
  tanggal_mulai: string;
  tanggal_selesai: string;
  kategori: KategoriAbsen;
  keterangan?: string;
}): Promise<FormResult> {
  if (!(await canAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak tertaut ke data pegawai." };
  }
  if (!KATEGORI_VALID.includes(input.kategori)) {
    return { ok: false, error: "Kategori tidak valid." };
  }
  if (!input.tanggal_mulai || !input.tanggal_selesai) {
    return { ok: false, error: "Tanggal wajib diisi." };
  }
  if (input.tanggal_selesai < input.tanggal_mulai) {
    return { ok: false, error: "Tanggal selesai harus sama atau setelah tanggal mulai." };
  }

  const dates = enumerateDates(input.tanggal_mulai, input.tanggal_selesai);
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

  const rows = dates.map((tanggal) => ({
    pegawai_id: profile.pegawai_id,
    tanggal,
    kategori_absen: input.kategori,
    keterangan: input.keterangan || null,
  }));
  const { error } = await supabase
    .from("absensi")
    .upsert(rows, { onConflict: "pegawai_id,tanggal" });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function clockOut(lat: number, long: number): Promise<FormResult> {
  if (!(await canAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak tertaut ke data pegawai." };
  }

  const geofenceError = await checkGeofence(lat, long);
  if (geofenceError) return { ok: false, error: geofenceError };

  const supabase = await createClient();
  const tanggal = todayJakarta();
  const { data: existing } = await supabase
    .from("absensi")
    .select("id, jam_masuk_aktual, jam_pulang_aktual")
    .eq("pegawai_id", profile.pegawai_id)
    .eq("tanggal", tanggal)
    .maybeSingle();
  if (!existing?.jam_masuk_aktual) {
    return { ok: false, error: "Belum clock in hari ini." };
  }
  if (existing.jam_pulang_aktual) {
    return { ok: false, error: "Sudah clock out hari ini." };
  }

  const { error } = await supabase
    .from("absensi")
    .update({
      jam_pulang_aktual: new Date().toISOString(),
      lokasi_pulang_lat: lat,
      lokasi_pulang_long: long,
    })
    .eq("id", existing.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
