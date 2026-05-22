"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { poinSchema, type PoinInput, type PoinTipe } from "./schema";

function pathFor(tipe: PoinTipe): string {
  return tipe === "POSITIF" ? "/master/poin-positif" : "/master/poin-negatif";
}

function payload(input: PoinInput) {
  return {
    kode_poin: input.kode_poin,
    nama_poin: input.nama_poin,
    deskripsi_poin: input.deskripsi_poin || null,
    nilai_poin: input.nilai_poin,
    level: input.level || null,
    keterangan: input.keterangan || null,
    is_aktif: input.is_aktif,
  };
}

export async function createPoin(
  tipe: PoinTipe,
  input: PoinInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = poinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("master_poin")
    .insert({ ...payload(parsed.data), tipe });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(pathFor(tipe));
  return { ok: true };
}

export async function updatePoin(
  tipe: PoinTipe,
  id: string,
  input: PoinInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = poinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("master_poin")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(pathFor(tipe));
  return { ok: true };
}

/**
 * Soft delete: nonaktifkan poin (PRD aturan 8 — histori transaksi aman karena
 * snapshot). Bisa diaktifkan lagi lewat form edit.
 */
export async function deletePoin(
  tipe: PoinTipe,
  id: string,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("master_poin")
    .update({ is_aktif: false })
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(pathFor(tipe));
  return { ok: true };
}
