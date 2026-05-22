"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { levelPoinSchema, type LevelPoinInput } from "./schema";

const PATH = "/master/level-poin";
// Form poin membaca level dari sini, jadi ikut di-revalidate.
const POIN_PATHS = ["/master/poin-positif", "/master/poin-negatif"];

function revalidateAll() {
  revalidatePath(PATH);
  for (const p of POIN_PATHS) revalidatePath(p);
}

export async function createLevelPoin(
  input: LevelPoinInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = levelPoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("master_level_poin").insert(parsed.data);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidateAll();
  return { ok: true };
}

export async function updateLevelPoin(
  id: string,
  input: LevelPoinInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = levelPoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("master_level_poin")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidateAll();
  return { ok: true };
}

export async function deleteLevelPoin(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("master_level_poin")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidateAll();
  return { ok: true };
}
