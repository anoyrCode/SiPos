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
    jam_masuk_jadwal: input.jam_masuk_jadwal || null,
    jam_pulang_jadwal: input.jam_pulang_jadwal || null,
    hari_libur:
      input.hari_libur !== undefined && input.hari_libur !== ""
        ? Number(input.hari_libur)
        : null,
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
