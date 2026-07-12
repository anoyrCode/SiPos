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

const MAX_BUKTI_BYTES = 5 * 1024 * 1024;
const ALLOWED_BUKTI_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  return "jpg";
}

/** Ajukan izin/sakit/cuti sendiri (approval oleh HRD/admin) utk 1 hari/rentang. */
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

  const { data: pengajuan, error: pengajuanErr } = await supabase
    .from("absensi_pengajuan")
    .insert({
      pegawai_id: profile.pegawai_id,
      kategori,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      keterangan: keterangan || null,
    })
    .select("id")
    .single();
  if (pengajuanErr || !pengajuan) {
    return { ok: false, error: dbErrorMessage(pengajuanErr) };
  }

  if (file) {
    const path = `${profile.pegawai_id}/${pengajuan.id}.${extFromMime(file.type)}`;
    const { error: uploadErr } = await supabase.storage
      .from("bukti-absensi")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadErr) {
      return { ok: false, error: "Gagal upload bukti. Coba lagi." };
    }
    await supabase
      .from("absensi_pengajuan")
      .update({ bukti_url: path })
      .eq("id", pengajuan.id);
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
