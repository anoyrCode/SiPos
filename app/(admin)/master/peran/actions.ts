"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canAkun } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { peranSchema, type PeranInput } from "./schema";

const PATH = "/master/peran";

export async function createPeran(input: PeranInput): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = peranSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("app_role").insert(parsed.data);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updatePeran(
  id: string,
  input: PeranInput,
): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = peranSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_role")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deletePeran(id: string): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();

  // Peran administrator (super) tidak boleh dihapus.
  const { data: role } = await supabase
    .from("app_role")
    .select("is_super")
    .eq("id", id)
    .maybeSingle();
  if (role?.is_super) {
    return { ok: false, error: "Peran administrator tidak boleh dihapus." };
  }

  // Tolak hapus bila masih dipakai akun.
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("app_role_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Peran masih dipakai ${count} akun. Pindahkan akun dulu.`,
    };
  }

  const { error } = await supabase.from("app_role").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
