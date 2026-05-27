"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/master/kelas-wali";

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
