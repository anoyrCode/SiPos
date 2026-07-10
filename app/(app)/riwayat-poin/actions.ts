"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { editTransaksiSchema, type EditTransaksiInput } from "./schema";

export async function deleteTransaksi(id: string): Promise<FormResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Hanya admin yang bisa menghapus." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transaksi_poin").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/riwayat-poin");
  return { ok: true };
}

/**
 * Ubah tanggal/nilai/catatan transaksi yang sudah tercatat (admin saja).
 * `nilai_poin` di sini selalu berlaku sebagai override — is_override
 * dihitung ulang dibanding nilai baku master_poin-nya.
 */
export async function updateTransaksi(
  id: string,
  input: EditTransaksiInput,
): Promise<FormResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Hanya admin yang bisa mengubah." };
  }

  const parsed = editTransaksiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("transaksi_poin")
    .select("master_poin:master_poin(nilai_poin)")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "Transaksi tidak ditemukan." };
  const masterPoin = current.master_poin as unknown as
    | { nilai_poin: number }
    | { nilai_poin: number }[]
    | null;
  const masterNilai = Array.isArray(masterPoin)
    ? (masterPoin[0]?.nilai_poin ?? null)
    : (masterPoin?.nilai_poin ?? null);

  const { error } = await supabase
    .from("transaksi_poin")
    .update({
      tanggal_kejadian: v.tanggal_kejadian,
      nilai_poin: v.nilai_poin,
      catatan: v.catatan || null,
      is_override: masterNilai !== null && v.nilai_poin !== masterNilai,
    })
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/riwayat-poin");
  return { ok: true };
}
