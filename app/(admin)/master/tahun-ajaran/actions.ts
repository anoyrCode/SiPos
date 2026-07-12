"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { tahunAjaranSchema, type TahunAjaranInput } from "./schema";

const PATH = "/master/tahun-ajaran";

function payload(input: TahunAjaranInput) {
  return {
    tahun: input.tahun,
    tanggal_mulai: input.tanggal_mulai || null,
    tanggal_selesai: input.tanggal_selesai || null,
    is_aktif: input.is_aktif,
  };
}

export async function createTahunAjaran(
  input: TahunAjaranInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = tahunAjaranSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("tahun_ajaran").insert(payload(parsed.data));
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateTahunAjaran(
  id: string,
  input: TahunAjaranInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = tahunAjaranSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tahun_ajaran")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Aktifkan satu tahun ajaran (trigger DB menon-aktifkan yang lain). */
export async function setTahunAjaranAktif(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tahun_ajaran")
    .update({ is_aktif: true })
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTahunAjaran(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();

  // kelas & transaksi_poin merujuk tahun_ajaran_id tanpa cascade (RESTRICT
  // di level DB) — cek dulu supaya pesan errornya jelas, bukan generik.
  const [kelasCount, transaksiCount] = await Promise.all([
    supabase
      .from("kelas")
      .select("id", { count: "exact", head: true })
      .eq("tahun_ajaran_id", id),
    supabase
      .from("transaksi_poin")
      .select("id", { count: "exact", head: true })
      .eq("tahun_ajaran_id", id),
  ]);
  if ((kelasCount.count ?? 0) > 0) {
    return {
      ok: false,
      error: `Tahun ajaran masih punya ${kelasCount.count} kelas. Hapus/pindahkan kelas dulu.`,
    };
  }
  if ((transaksiCount.count ?? 0) > 0) {
    return {
      ok: false,
      error: `Tahun ajaran masih punya ${transaksiCount.count} transaksi poin.`,
    };
  }

  const { error } = await supabase.from("tahun_ajaran").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
