"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { canAkun, getUser } from "@/lib/auth/dal";
import { type FormResult } from "@/lib/forms";

const PATH = "/master/akun-staff";

type StaffInput = {
  email: string;
  password: string;
  app_role_id: string;
  pegawai_id?: string | null;
};

export async function createStaffAccount(
  input: StaffInput,
): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };

  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email wajib diisi." };
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter." };
  }
  if (!input.app_role_id) return { ok: false, error: "Pilih peran." };

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: "pegawai" },
  });
  if (error || !created.user) {
    return { ok: false, error: error?.message ?? "Gagal membuat akun." };
  }

  const userId = created.user.id;
  // Trigger membuat profil default → set peran + tautan pegawai.
  await admin
    .from("profiles")
    .update({
      app_role_id: input.app_role_id,
      pegawai_id: input.pegawai_id || null,
    })
    .eq("id", userId);
  if (input.pegawai_id) {
    await admin.from("pegawai").update({ user_id: userId }).eq("id", input.pegawai_id);
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateStaffAccount(
  userId: string,
  input: { app_role_id: string; pegawai_id?: string | null },
): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };
  if (!input.app_role_id) return { ok: false, error: "Pilih peran." };

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      app_role_id: input.app_role_id,
      pegawai_id: input.pegawai_id || null,
    })
    .eq("id", userId);

  // Sinkronkan tautan pegawai.user_id (lepas yang lama, pasang yang baru).
  await admin.from("pegawai").update({ user_id: null }).eq("user_id", userId);
  if (input.pegawai_id) {
    await admin.from("pegawai").update({ user_id: userId }).eq("id", input.pegawai_id);
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function resetStaffPassword(
  userId: string,
  password: string,
): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };
  if (!password || password.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteStaffAccount(userId: string): Promise<FormResult> {
  if (!(await canAkun())) return { ok: false, error: "Tidak diizinkan." };

  const me = await getUser();
  if (me?.id === userId) {
    return { ok: false, error: "Tidak bisa menghapus akun sendiri." };
  }

  const admin = createAdminClient();
  await admin.from("pegawai").update({ user_id: null }).eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true };
}
