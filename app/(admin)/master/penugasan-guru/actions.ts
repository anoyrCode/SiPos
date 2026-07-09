"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/master/penugasan-guru";

export type Shift = 1 | 2 | 3;

async function activeTaId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  return data?.id ?? null;
}

export type Penugasan = { kelasIds: string[]; shift: Shift | null };

/** Kelas (TA aktif) + shift yang ditugaskan ke seorang pegawai. */
export async function getPenugasan(pegawaiId: string): Promise<Penugasan> {
  if (!(await canMaster())) return { kelasIds: [], shift: null };
  const supabase = await createClient();
  const taId = await activeTaId(supabase);

  const { data: pegawai } = await supabase
    .from("pegawai")
    .select("shift")
    .eq("id", pegawaiId)
    .maybeSingle();

  if (!taId) return { kelasIds: [], shift: (pegawai?.shift as Shift) ?? null };

  const { data } = await supabase
    .from("guru_kelas")
    .select("kelas_id, kelas:kelas!inner(tahun_ajaran_id)")
    .eq("pegawai_id", pegawaiId)
    .eq("kelas.tahun_ajaran_id", taId);
  const kelasIds = ((data ?? []) as unknown as { kelas_id: string }[]).map(
    (r) => r.kelas_id,
  );
  return { kelasIds, shift: (pegawai?.shift as Shift) ?? null };
}

/** Set penugasan kelas (TA aktif) + shift untuk pegawai. */
export async function setPenugasan(
  pegawaiId: string,
  kelasIds: string[],
  shift: Shift | null,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const taId = await activeTaId(supabase);
  if (!taId) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  const { error: shiftError } = await supabase
    .from("pegawai")
    .update({ shift })
    .eq("id", pegawaiId);
  if (shiftError) return { ok: false, error: dbErrorMessage(shiftError) };

  const { data: cur } = await supabase
    .from("guru_kelas")
    .select("id, kelas_id, kelas:kelas!inner(tahun_ajaran_id)")
    .eq("pegawai_id", pegawaiId)
    .eq("kelas.tahun_ajaran_id", taId);
  const current = (cur ?? []) as unknown as { id: string; kelas_id: string }[];
  const currentIds = new Set(current.map((r) => r.kelas_id));
  const target = new Set(kelasIds);

  const toRemove = current.filter((r) => !target.has(r.kelas_id)).map((r) => r.id);
  const toAdd = kelasIds
    .filter((id) => !currentIds.has(id))
    .map((kelas_id) => ({ pegawai_id: pegawaiId, kelas_id }));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("guru_kelas")
      .delete()
      .in("id", toRemove);
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("guru_kelas")
      .upsert(toAdd, { onConflict: "pegawai_id,kelas_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }

  revalidatePath(PATH);
  return { ok: true };
}
