"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canAbsensiSantri, getProfile } from "@/lib/auth/dal";
import { todayJakarta, nowHHMMJakarta } from "@/lib/absensi-status";
import { tanggalShift } from "@/lib/absensi-santri";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const MAX_ISI = 500;

function validasi(jam: string, isi: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(jam)) return "Format jam tidak valid.";
  const teks = isi.trim();
  if (teks.length === 0) return "Isi catatan tidak boleh kosong.";
  if (teks.length > MAX_ISI) return `Catatan maksimal ${MAX_ISI} karakter.`;
  return null;
}

/**
 * Tanggal yang berlaku untuk shift pegawai ini SEKARANG. Dihitung ulang di
 * server (tidak menerima kiriman klien) supaya catatan tidak bisa ditulis ke
 * tanggal sembarang. Untuk shift 3 hasilnya tanggal MULAI malam jaga.
 */
async function tanggalUntukShift(shift: number): Promise<string | null> {
  const supabase = await createClient();
  const { data: cps } = await supabase
    .from("absensi_santri_checkpoint")
    .select("jam")
    .eq("shift", shift)
    .order("urutan");
  if (!cps || cps.length === 0) return null;
  return tanggalShift(cps, nowHHMMJakarta(), todayJakarta());
}

export async function tambahCatatan(
  kelasId: string,
  jam: string,
  isi: string,
): Promise<FormResult> {
  if (!(await canAbsensiSantri())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id || !profile.shift) {
    return {
      ok: false,
      error: "Akun ini tidak terhubung ke data pegawai atau belum diatur shift-nya.",
    };
  }
  const pesan = validasi(jam, isi);
  if (pesan) return { ok: false, error: pesan };

  const tanggal = await tanggalUntukShift(profile.shift);
  if (!tanggal) return { ok: false, error: "Jadwal checkpoint tidak ditemukan." };

  const supabase = await createClient();
  const { error } = await supabase.from("absensi_santri_catatan").insert({
    kelas_id: kelasId,
    tanggal,
    shift: profile.shift,
    jam: `${jam}:00`,
    isi: isi.trim(),
    dicatat_oleh: profile.pegawai_id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/absensi-santri");
  revalidatePath("/rekap-absensi-santri");
  return { ok: true };
}

export async function ubahCatatan(
  id: string,
  jam: string,
  isi: string,
): Promise<FormResult> {
  if (!(await canAbsensiSantri())) return { ok: false, error: "Tidak diizinkan." };
  const pesan = validasi(jam, isi);
  if (pesan) return { ok: false, error: pesan };

  const supabase = await createClient();
  // RLS (can_absensi_santri_shift) yang menentukan boleh/tidaknya. `select`
  // dipakai untuk mendeteksi baris yang tidak tersentuh — tanpa itu, update
  // yang ditolak RLS akan sukses secara diam-diam dengan 0 baris terpengaruh.
  const { data, error } = await supabase
    .from("absensi_santri_catatan")
    .update({ jam: `${jam}:00`, isi: isi.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Catatan tidak ditemukan atau bukan milik Anda." };
  }

  revalidatePath("/absensi-santri");
  revalidatePath("/rekap-absensi-santri");
  return { ok: true };
}

export async function hapusCatatan(id: string): Promise<FormResult> {
  if (!(await canAbsensiSantri())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("absensi_santri_catatan")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Catatan tidak ditemukan atau bukan milik Anda." };
  }

  revalidatePath("/absensi-santri");
  revalidatePath("/rekap-absensi-santri");
  return { ok: true };
}
