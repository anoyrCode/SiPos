"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth/dal";
import { dateJakarta, todayJakarta } from "@/lib/absensi-status";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { editTransaksiSchema, type EditTransaksiInput } from "./schema";

const OWNERSHIP_ERROR =
  "Transaksi ini bukan milik Anda atau sudah melewati batas waktu edit (hari yang sama).";

/**
 * Admin selalu boleh. Selain admin, hanya boleh kalau transaksi itu milik
 * pegawai yang sedang login (pegawai_id cocok) DAN dibuat hari ini (WIB) —
 * mirror persis kondisi RLS `transaksi_update_own_today`/`transaksi_delete_own_today`
 * (migrasi 0039), supaya pesan error di sini ramah, bukan silent-no-op RLS.
 */
async function canTouchTransaksi(row: {
  pegawai_id: string | null;
  created_at: string;
}): Promise<boolean> {
  if (await isAdmin()) return true;
  const profile = await getProfile();
  if (!profile?.pegawai_id || row.pegawai_id !== profile.pegawai_id) return false;
  return dateJakarta(row.created_at) === todayJakarta();
}

export async function deleteTransaksi(id: string): Promise<FormResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("transaksi_poin")
    .select("pegawai_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Transaksi tidak ditemukan." };
  if (!(await canTouchTransaksi(row))) {
    return { ok: false, error: OWNERSHIP_ERROR };
  }

  const { error } = await supabase.from("transaksi_poin").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/riwayat-poin");
  return { ok: true };
}

/**
 * Ubah tanggal/nilai/catatan transaksi yang sudah tercatat — admin kapan
 * saja, pegawai lain hanya transaksi miliknya sendiri di hari yang sama
 * (lihat canTouchTransaksi). `nilai_poin` di sini selalu berlaku sebagai
 * override — is_override dihitung ulang dibanding nilai baku master_poin-nya,
 * sama untuk admin maupun pegawai — tidak ada percabangan logic terpisah.
 */
export async function updateTransaksi(
  id: string,
  input: EditTransaksiInput,
): Promise<FormResult> {
  const parsed = editTransaksiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("transaksi_poin")
    .select("pegawai_id, created_at, master_poin:master_poin(nilai_poin)")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "Transaksi tidak ditemukan." };
  if (!(await canTouchTransaksi(current))) {
    return { ok: false, error: OWNERSHIP_ERROR };
  }

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
