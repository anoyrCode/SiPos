"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

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
