"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/master/kelas-wali";

/** Jumlah id maksimal per permintaan `.in(...)` — lihat catatan di addSantriToKelas. */
const SANTRI_CHUNK_SIZE = 150;

export async function setWaliKelas(
  kelasId: string,
  waliId: string | null,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kelas")
    .update({ wali_id: waliId })
    .eq("id", kelasId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function addSantriToKelas(
  kelasId: string,
  santriIds: string[],
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  if (santriIds.length === 0) return { ok: false, error: "Pilih minimal satu santri." };

  const supabase = await createClient();

  // Kelas tanpa gender tidak divalidasi. Kalau kelasnya bergender, santri
  // dengan gender berbeda ditolak SEMUA (tidak ada yang tersimpan sebagian).
  // Santri yang gendernya kosong di database dibiarkan lolos — sistem tidak
  // bisa membuktikan dia tidak cocok.
  const { data: kelas, error: kelasError } = await supabase
    .from("kelas")
    .select("nama_kelas, jenis_kelamin")
    .eq("id", kelasId)
    .single();
  // Gagal membaca kelas = tolak. Kalau errornya diabaikan, `kelas` jadi null
  // dan pemeriksaan gender di bawah dilewati diam-diam.
  if (kelasError || !kelas) {
    return { ok: false, error: "Gagal membaca data kelas. Coba lagi sebentar." };
  }

  if (kelas.jenis_kelamin) {
    const lawan = kelas.jenis_kelamin === "L" ? "P" : "L";
    // `.in(...)` menaruh seluruh id di URL — ratusan UUID sekaligus melewati
    // batas panjang URL server dan permintaannya ditolak diam-diam (masalah
    // yang sama pernah bikin nama santri di Laporan jatuh ke "?"). Dipotong.
    const chunks = await Promise.all(
      Array.from(
        { length: Math.ceil(santriIds.length / SANTRI_CHUNK_SIZE) },
        (_, i) =>
          supabase
            .from("santri")
            .select("nama")
            .in(
              "id",
              santriIds.slice(i * SANTRI_CHUNK_SIZE, (i + 1) * SANTRI_CHUNK_SIZE),
            )
            .eq("jenis_kelamin", lawan),
      ),
    );
    const gagal = chunks.find((c) => c.error);
    if (gagal?.error) {
      return { ok: false, error: "Gagal memeriksa data santri. Coba lagi sebentar." };
    }
    const mismatch = chunks.flatMap((c) => c.data ?? []);
    if (mismatch.length > 0) {
      const label = kelas.jenis_kelamin === "L" ? "Putra" : "Putri";
      const nama = mismatch.map((s) => s.nama).join(", ");
      return {
        ok: false,
        error: `${nama} tidak bisa masuk kelas ${kelas.nama_kelas} karena kelas ini ditandai ${label}.`,
      };
    }
  }

  const rows = santriIds.map((santri_id) => ({ santri_id, kelas_id: kelasId }));
  const { error } = await supabase.from("santri_kelas").insert(rows);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function removeSantriFromKelas(
  santriKelasId: string,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("santri_kelas")
    .delete()
    .eq("id", santriKelasId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
