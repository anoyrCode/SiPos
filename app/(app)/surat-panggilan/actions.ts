"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster, canTindakLanjutSp, getProfile } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/surat-panggilan";

/** Tandai santri sebagai "sudah ditindak" untuk level SP tertentu (1/2/3). */
export async function tandaiTindakLanjut(
  santriId: string,
  taId: string,
  level: number,
): Promise<FormResult> {
  if (!(await canTindakLanjutSp())) {
    return { ok: false, error: "Tidak diizinkan." };
  }

  const profile = await getProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("surat_panggilan_tindak_lanjut").insert({
    santri_id: santriId,
    tahun_ajaran_id: taId,
    level,
    ditandai_oleh: profile?.pegawai_id ?? null,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Batalkan tanda tindak lanjut — santri akan muncul lagi di daftar. */
export async function batalkanTindakLanjut(id: string): Promise<FormResult> {
  if (!(await canTindakLanjutSp())) {
    return { ok: false, error: "Tidak diizinkan." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("surat_panggilan_tindak_lanjut")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Ubah ambang SP1/SP2/SP3. Hanya perm_master (sesuai RLS tabelnya). */
export async function updateAmbangSp(input: {
  ambang_sp1: number;
  ambang_sp2: number;
  ambang_sp3: number;
}): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  if (
    !(input.ambang_sp1 < input.ambang_sp2 && input.ambang_sp2 < input.ambang_sp3)
  ) {
    return { ok: false, error: "Ambang harus naik: SP1 < SP2 < SP3." };
  }

  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("surat_panggilan_pengaturan")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!setting) return { ok: false, error: "Baris pengaturan tidak ditemukan." };

  const { error } = await supabase
    .from("surat_panggilan_pengaturan")
    .update({
      ambang_sp1: input.ambang_sp1,
      ambang_sp2: input.ambang_sp2,
      ambang_sp3: input.ambang_sp3,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setting.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/dashboard");
  return { ok: true };
}
