"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { kelasSchema, type KelasInput } from "./schema";

const PATH = "/master/kelas";

function payload(input: KelasInput) {
  return {
    nama_kelas: input.nama_kelas,
    level_pendidikan_id: input.level_pendidikan_id,
    tahun_ajaran_id: input.tahun_ajaran_id,
    wali_id: input.wali_id || null,
  };
}

export async function createKelas(input: KelasInput): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = kelasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("kelas").insert(payload(parsed.data));
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateKelas(
  id: string,
  input: KelasInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = kelasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kelas")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteKelas(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();

  // santri_kelas/guru_kelas pakai on delete cascade — kalau masih ada
  // santri/musyrif di kelas ini, blokir dulu (jangan diam-diam terhapus).
  const [santriCount, guruCount] = await Promise.all([
    supabase
      .from("santri_kelas")
      .select("id", { count: "exact", head: true })
      .eq("kelas_id", id),
    supabase
      .from("guru_kelas")
      .select("id", { count: "exact", head: true })
      .eq("kelas_id", id),
  ]);
  if ((santriCount.count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kelas masih punya ${santriCount.count} santri. Pindahkan santri dulu.`,
    };
  }
  if ((guruCount.count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kelas masih ditugaskan ke ${guruCount.count} musyrif. Ubah penugasan dulu.`,
    };
  }

  const { error } = await supabase.from("kelas").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
