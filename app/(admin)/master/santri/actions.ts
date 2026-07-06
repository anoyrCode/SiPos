"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canSantri } from "@/lib/auth/dal";
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
  if (!(await canSantri())) return { ok: false, error: "Tidak diizinkan." };
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
  if (!(await canSantri())) return { ok: false, error: "Tidak diizinkan." };
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
  if (!(await canSantri())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase.from("santri").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
