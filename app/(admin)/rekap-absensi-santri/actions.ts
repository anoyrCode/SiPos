"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/rekap-absensi-santri";

export async function addCheckpoint(
  shift: number,
  jam: string,
  urutan: number,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("absensi_santri_checkpoint")
    .insert({ shift, jam, urutan });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/absensi-santri");
  return { ok: true };
}

export async function deleteCheckpoint(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("absensi_santri_checkpoint")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/absensi-santri");
  return { ok: true };
}
