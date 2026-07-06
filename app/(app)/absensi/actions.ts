"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canAbsensi, getProfile } from "@/lib/auth/dal";
import { haversineDistanceMeters } from "@/lib/geo";
import { todayJakarta } from "@/lib/absensi-status";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/absensi";

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
    .select("jam_masuk_jadwal")
    .eq("id", profile.pegawai_id)
    .maybeSingle();
  if (!pegawai?.jam_masuk_jadwal) {
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
