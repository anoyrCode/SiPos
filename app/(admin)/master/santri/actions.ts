"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { santriSchema, type SantriInput } from "./schema";

const PATH = "/master/santri";

function payload(input: SantriInput) {
  return {
    nis: input.nis || null,
    nisn: input.nisn || null,
    nama: input.nama,
    email: input.email || null,
    jenis_kelamin: input.jenis_kelamin ?? null,
    nama_ayah: input.nama_ayah || null,
    nama_ibu: input.nama_ibu || null,
    nama_wali: input.nama_wali || null,
    no_telp_wali: input.no_telp_wali || null,
    status: input.status,
  };
}

export async function createSantri(input: SantriInput): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = santriSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("santri").insert(payload(parsed.data));
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateSantri(
  id: string,
  input: SantriInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = santriSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("santri")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteSantri(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase.from("santri").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Cek NIS yang sudah ada di database (untuk validasi import CSV). */
export async function checkExistingNis(keys: string[]): Promise<string[]> {
  if (!(await canMaster())) return [];
  if (keys.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("santri").select("nis").in("nis", keys);
  return (data ?? []).map((r) => r.nis).filter((v): v is string => Boolean(v));
}

/** Bulk import santri dari CSV (re-validasi tiap baris). */
export async function importSantri(
  rows: SantriInput[],
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!(await canMaster())) return { ok: false, inserted: 0, error: "Tidak diizinkan." };
  if (rows.length === 0) return { ok: false, inserted: 0, error: "Tidak ada data." };

  const payloads = [];
  for (const row of rows) {
    const parsed = santriSchema.safeParse(row);
    if (!parsed.success) {
      return { ok: false, inserted: 0, error: "Ada baris yang tidak valid." };
    }
    payloads.push(payload(parsed.data));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("santri").insert(payloads).select("id");
  if (error) return { ok: false, inserted: 0, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true, inserted: data?.length ?? payloads.length };
}
