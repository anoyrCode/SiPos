"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { canAkun, canAkunStaff, getUser } from "@/lib/auth/dal";
import { type FormResult } from "@/lib/forms";

const PATH = "/master/akun-staff";

type StaffInput = {
  email: string;
  password: string;
  app_role_id: string;
  pegawai_id?: string | null;
};

/**
 * Peran sempit (akun_staff tanpa akun penuh) tidak boleh menetapkan/menyentuh
 * akun yang berperan admin/akun-penuh — mencegah eskalasi hak akses.
 */
async function assertRoleAssignable(appRoleId: string): Promise<string | null> {
  if (await canAkun()) return null;
  const admin = createAdminClient();
  const { data: role } = await admin
    .from("app_role")
    .select("is_super, perm_akun")
    .eq("id", appRoleId)
    .maybeSingle();
  if (role?.is_super || role?.perm_akun) {
    return "Tidak boleh menetapkan peran admin/akun penuh.";
  }
  return null;
}

async function assertAccountTouchable(userId: string): Promise<string | null> {
  if (await canAkun()) return null;
  const admin = createAdminClient();
  const { data: acc } = await admin
    .from("profiles")
    .select("role, app_role:app_role(is_super, perm_akun)")
    .eq("id", userId)
    .maybeSingle();
  const role = (
    Array.isArray(acc?.app_role) ? acc?.app_role[0] : acc?.app_role
  ) as { is_super: boolean; perm_akun: boolean } | undefined;
  // profiles.role = "admin" adalah admin walau app_role_id null (mis. akun
  // bootstrap pertama) — harus tetap terlindungi meski app_role tidak ada.
  if (acc?.role === "admin" || role?.is_super || role?.perm_akun) {
    return "Tidak boleh mengubah akun admin/akun penuh.";
  }
  return null;
}

export async function createStaffAccount(
  input: StaffInput,
): Promise<FormResult> {
  if (!(await canAkunStaff())) return { ok: false, error: "Tidak diizinkan." };

  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email wajib diisi." };
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter." };
  }
  if (!input.app_role_id) return { ok: false, error: "Pilih peran." };
  const roleErr = await assertRoleAssignable(input.app_role_id);
  if (roleErr) return { ok: false, error: roleErr };

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
  if (!(await canAkunStaff())) return { ok: false, error: "Tidak diizinkan." };
  if (!input.app_role_id) return { ok: false, error: "Pilih peran." };
  const touchErr = await assertAccountTouchable(userId);
  if (touchErr) return { ok: false, error: touchErr };
  const roleErr = await assertRoleAssignable(input.app_role_id);
  if (roleErr) return { ok: false, error: roleErr };

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
  if (!(await canAkunStaff())) return { ok: false, error: "Tidak diizinkan." };
  if (!password || password.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter." };
  }
  const touchErr = await assertAccountTouchable(userId);
  if (touchErr) return { ok: false, error: touchErr };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteStaffAccount(userId: string): Promise<FormResult> {
  if (!(await canAkunStaff())) return { ok: false, error: "Tidak diizinkan." };

  const me = await getUser();
  if (me?.id === userId) {
    return { ok: false, error: "Tidak bisa menghapus akun sendiri." };
  }
  const touchErr = await assertAccountTouchable(userId);
  if (touchErr) return { ok: false, error: touchErr };

  const admin = createAdminClient();
  await admin.from("pegawai").update({ user_id: null }).eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true };
}
