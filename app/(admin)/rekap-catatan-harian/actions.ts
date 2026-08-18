"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canRekapCatatanHarian, getProfile } from "@/lib/auth/dal";
import { todayJakarta } from "@/lib/absensi-status";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import type { JenisCatatan } from "@/lib/catatan-harian";

const MAX_ISI = 1000;
const JENIS_SAH: JenisCatatan[] = ["baik", "perhatian", "info"];

function validasi(tanggal: string, jenis: string, isi: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return "Format tanggal tidak valid.";
  if (tanggal > todayJakarta()) return "Tanggal tidak boleh melewati hari ini.";
  if (!JENIS_SAH.includes(jenis as JenisCatatan)) return "Jenis catatan tidak valid.";
  const teks = isi.trim();
  if (teks.length === 0) return "Isi catatan tidak boleh kosong.";
  if (teks.length > MAX_ISI) return `Catatan maksimal ${MAX_ISI} karakter.`;
  return null;
}

export async function ubahCatatanAdmin(
  id: string,
  tanggal: string,
  jenis: string,
  isi: string,
): Promise<FormResult> {
  if (!(await canRekapCatatanHarian())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  const pesan = validasi(tanggal, jenis, isi);
  if (pesan) return { ok: false, error: pesan };

  const supabase = await createClient();

  // `dicatat_oleh` dibaca lebih dulu untuk menentukan apakah ini penyuntingan
  // oleh ORANG LAIN. Penulis yang memperbaiki tulisannya sendiri tidak
  // meninggalkan penanda — dan penanda lama justru dikosongkan, karena
  // menyisakannya akan berbohong tentang keadaan terkini.
  const { data: baris } = await supabase
    .from("catatan_harian")
    .select("dicatat_oleh")
    .eq("id", id)
    .maybeSingle();
  if (!baris) return { ok: false, error: "Catatan tidak ditemukan." };

  const olehOrangLain =
    !profile?.pegawai_id || baris.dicatat_oleh !== profile.pegawai_id;

  const { data, error } = await supabase
    .from("catatan_harian")
    .update({
      tanggal,
      jenis,
      isi: isi.trim(),
      updated_at: new Date().toISOString(),
      disunting_oleh: olehOrangLain ? (profile?.pegawai_id ?? null) : null,
      disunting_at: olehOrangLain ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Catatan tidak ditemukan atau tidak dapat diubah." };
  }

  revalidatePath("/rekap-catatan-harian");
  revalidatePath("/catatan-harian");
  return { ok: true };
}

export async function hapusCatatanAdmin(id: string): Promise<FormResult> {
  if (!(await canRekapCatatanHarian())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  // `select` dipakai untuk mendeteksi baris yang tidak tersentuh — tanpa itu,
  // delete yang ditolak RLS sukses secara diam-diam dengan 0 baris terpengaruh.
  const { data, error } = await supabase
    .from("catatan_harian")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Catatan tidak ditemukan atau tidak dapat dihapus." };
  }

  revalidatePath("/rekap-catatan-harian");
  revalidatePath("/catatan-harian");
  return { ok: true };
}
