"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canTindakLanjutSp, getProfile } from "@/lib/auth/dal";
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
