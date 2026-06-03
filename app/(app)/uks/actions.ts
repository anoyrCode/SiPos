"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canKesehatan, getProfile } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { rekamSchema, type RekamInput, type SantriHit } from "./schema";

const PATH = "/uks";

/** Cari santri aktif (utk pemilih saat mencatat). Hanya UKS/admin. */
export async function searchSantri(term: string): Promise<SantriHit[]> {
  if (!(await canKesehatan())) return [];
  const supabase = await createClient();
  let query = supabase
    .from("santri")
    .select("id, nis, nama")
    .eq("status", "aktif")
    .order("nama")
    .limit(20);
  const t = term.replace(/[,()*]/g, " ").trim();
  if (t) query = query.or(`nama.ilike.*${t}*,nis.ilike.*${t}*`);
  const { data } = await query;
  return (data ?? []) as SantriHit[];
}

export async function createRekam(input: RekamInput): Promise<FormResult> {
  if (!(await canKesehatan())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = rekamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const v = parsed.data;

  const supabase = await createClient();
  const profile = await getProfile();
  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  const { error } = await supabase.from("rekam_medis").insert({
    santri_id: v.santri_id,
    tanggal: v.tanggal,
    keluhan: v.keluhan,
    tindakan: v.tindakan || null,
    obat: v.obat || null,
    catatan: v.catatan || null,
    petugas_id: profile?.pegawai_id ?? null,
    tahun_ajaran_id: ta?.id ?? null,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateRekam(
  id: string,
  input: RekamInput,
): Promise<FormResult> {
  if (!(await canKesehatan())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = rekamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("rekam_medis")
    .update({
      tanggal: v.tanggal,
      keluhan: v.keluhan,
      tindakan: v.tindakan || null,
      obat: v.obat || null,
      catatan: v.catatan || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteRekam(id: string): Promise<FormResult> {
  if (!(await canKesehatan())) return { ok: false, error: "Tidak diizinkan." };
  const supabase = await createClient();
  const { error } = await supabase.from("rekam_medis").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
