"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { phoneToWaliEmail } from "@/lib/auth/phone";

export type LoginState = { error?: string } | undefined;

/**
 * Login email/password.
 * - mode "staff": pakai email (admin/pegawai).
 * - mode "wali": pakai no WA/telp → dipetakan ke email sintetis.
 */
export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const mode = String(formData.get("mode") ?? "staff");
  const password = String(formData.get("password") ?? "");

  let email: string;
  if (mode === "wali") {
    const phone = String(formData.get("phone") ?? "");
    if (!phone.trim()) return { error: "Nomor WA/telepon wajib diisi." };
    email = phoneToWaliEmail(phone);
  } else {
    email = String(formData.get("email") ?? "").trim();
    if (!email) return { error: "Email wajib diisi." };
  }
  if (!password) return { error: "Password wajib diisi." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      error:
        mode === "wali"
          ? "Nomor atau password salah."
          : "Email atau password salah.",
    };
  }

  // Beranda ditentukan oleh hak akses di "/" (app/page.tsx).
  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
