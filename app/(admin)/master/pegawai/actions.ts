"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canPegawai } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { pegawaiSchema, type PegawaiInput } from "./schema";

const PATH = "/master/pegawai";

function payload(input: PegawaiInput) {
  return {
    nip: input.nip || null,
    nama: input.nama,
    email: input.email || null,
    jabatan: input.jabatan || null,
    jenis_kelamin: input.jenis_kelamin ?? null,
    telp: input.telp || null,
    tempat_lahir: input.tempat_lahir || null,
    tanggal_lahir: input.tanggal_lahir || null,
    alamat: input.alamat || null,
  };
}

export async function createPegawai(input: PegawaiInput): Promise<FormResult> {
  if (!(await canPegawai())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = pegawaiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("pegawai").insert(payload(parsed.data));
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updatePegawai(
  id: string,
  input: PegawaiInput,
): Promise<FormResult> {
  if (!(await canPegawai())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = pegawaiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pegawai")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deletePegawai(id: string): Promise<FormResult> {
  if (!(await canPegawai())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase.from("pegawai").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Cek NIP yang sudah ada di database (untuk validasi import CSV). */
export async function checkExistingNip(keys: string[]): Promise<string[]> {
  if (!(await canPegawai())) return [];
  if (keys.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("pegawai").select("nip").in("nip", keys);
  return (data ?? []).map((r) => r.nip).filter((v): v is string => Boolean(v));
}

/** Bulk import pegawai dari CSV (re-validasi tiap baris). */
export async function importPegawai(
  rows: PegawaiInput[],
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!(await canPegawai())) return { ok: false, inserted: 0, error: "Tidak diizinkan." };
  if (rows.length === 0) return { ok: false, inserted: 0, error: "Tidak ada data." };

  const payloads = [];
  for (const row of rows) {
    const parsed = pegawaiSchema.safeParse(row);
    if (!parsed.success) {
      return { ok: false, inserted: 0, error: "Ada baris yang tidak valid." };
    }
    payloads.push(payload(parsed.data));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("pegawai").insert(payloads).select("id");
  if (error) return { ok: false, inserted: 0, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true, inserted: data?.length ?? payloads.length };
}
