"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAkunWali } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { normalizePhone, phoneToWaliEmail } from "@/lib/auth/phone";

const PATH = "/master/akun-wali";

type AccountResult = { ok: true; password: string } | { ok: false; error: string };
type GenerateResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Password awal default akun wali = "12345678" (sama untuk semua akun). */
function defaultPassword(): string {
  return "12345678";
}

/**
 * Generate akun wali dari data santri: kelompokkan `no_telp_wali` unik,
 * buat baris `wali` + relasi `wali_santri` (tanpa akun auth dulu).
 */
export async function generateWaliFromSantri(): Promise<GenerateResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data: santri, error } = await supabase
    .from("santri")
    .select("id, nama_wali, no_telp_wali")
    .not("no_telp_wali", "is", null);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const groups = new Map<string, { nama: string; santriIds: string[] }>();
  for (const s of santri ?? []) {
    const phone = normalizePhone(s.no_telp_wali ?? "");
    if (!phone) continue;
    const g = groups.get(phone) ?? { nama: "", santriIds: [] };
    if (!g.nama && s.nama_wali) g.nama = s.nama_wali;
    g.santriIds.push(s.id);
    groups.set(phone, g);
  }

  if (groups.size === 0) {
    revalidatePath(PATH);
    return { ok: true, message: "0 nomor wali diproses, 0 akun baru dibuat." };
  }

  const phones = [...groups.keys()];
  const { data: existingWali, error: existErr } = await supabase
    .from("wali")
    .select("id, no_telp")
    .in("no_telp", phones);
  if (existErr) return { ok: false, error: dbErrorMessage(existErr) };

  const waliIdByPhone = new Map((existingWali ?? []).map((w) => [w.no_telp, w.id]));

  const toInsert = phones
    .filter((phone) => !waliIdByPhone.has(phone))
    .map((phone) => ({ no_telp: phone, nama: groups.get(phone)!.nama || "Wali Santri" }));

  let createdWali = 0;
  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("wali")
      .insert(toInsert)
      .select("id, no_telp");
    if (insErr) return { ok: false, error: dbErrorMessage(insErr) };
    for (const w of inserted ?? []) {
      waliIdByPhone.set(w.no_telp, w.id);
    }
    createdWali = inserted?.length ?? 0;
  }

  const relasiRows = [...groups].flatMap(([phone, g]) => {
    const waliId = waliIdByPhone.get(phone);
    if (!waliId) return [];
    return g.santriIds.map((santri_id) => ({ wali_id: waliId, santri_id }));
  });

  if (relasiRows.length > 0) {
    const { error: relErr } = await supabase
      .from("wali_santri")
      .upsert(relasiRows, { onConflict: "wali_id,santri_id", ignoreDuplicates: true });
    if (relErr) return { ok: false, error: dbErrorMessage(relErr) };
  }

  revalidatePath(PATH);
  return {
    ok: true,
    message: `${groups.size} nomor wali diproses, ${createdWali} akun baru dibuat.`,
  };
}

/** Buat akun auth untuk wali (email sintetis dari no telp). */
export async function createWaliAccount(waliId: string): Promise<AccountResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data: wali } = await supabase
    .from("wali")
    .select("id, no_telp, user_id")
    .eq("id", waliId)
    .maybeSingle();
  if (!wali) return { ok: false, error: "Data wali tidak ditemukan." };
  if (wali.user_id) return { ok: false, error: "Akun sudah dibuat." };

  const email = phoneToWaliEmail(wali.no_telp);
  const password = defaultPassword();

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "wali" },
  });
  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? "Gagal membuat akun." };
  }

  const userId = created.user.id;
  // Trigger membuat profil default 'pegawai' → set eksplisit ke wali + tautkan.
  await admin
    .from("profiles")
    .update({ role: "wali", wali_id: waliId })
    .eq("id", userId);
  await admin.from("wali").update({ user_id: userId }).eq("id", waliId);

  revalidatePath(PATH);
  return { ok: true, password };
}

/** Reset password akun wali ke default ("12345678"). */
export async function resetWaliPassword(waliId: string): Promise<AccountResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data: wali } = await supabase
    .from("wali")
    .select("id, no_telp, user_id")
    .eq("id", waliId)
    .maybeSingle();
  if (!wali?.user_id) return { ok: false, error: "Akun belum dibuat." };

  const password = defaultPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(wali.user_id, {
    password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, password };
}

/** Hapus akun auth wali (data wali & relasi tetap). */
export async function deleteWaliAccount(waliId: string): Promise<FormResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data: wali } = await supabase
    .from("wali")
    .select("id, user_id")
    .eq("id", waliId)
    .maybeSingle();
  if (!wali?.user_id) return { ok: false, error: "Akun belum dibuat." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(wali.user_id);
  if (error) return { ok: false, error: error.message };

  await admin.from("wali").update({ user_id: null }).eq("id", waliId);

  revalidatePath(PATH);
  return { ok: true };
}

/** Hapus data wali (akun login & relasi ke santri ikut terhapus). */
export async function deleteWali(waliId: string): Promise<FormResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data: wali } = await supabase
    .from("wali")
    .select("id, user_id")
    .eq("id", waliId)
    .maybeSingle();
  if (!wali) return { ok: false, error: "Data wali tidak ditemukan." };

  const admin = createAdminClient();
  if (wali.user_id) {
    const { error: authErr } = await admin.auth.admin.deleteUser(wali.user_id);
    if (authErr) return { ok: false, error: authErr.message };
  }

  const { error } = await admin.from("wali").delete().eq("id", waliId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Daftar anak terhubung ke seorang wali (untuk dialog edit relasi). */
export async function getWaliAnak(
  waliId: string,
): Promise<{ id: string; santri: { id: string; nis: string | null; nama: string } | null }[]> {
  if (!(await canAkunWali())) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("wali_santri")
    .select("id, santri:santri(id, nis, nama)")
    .eq("wali_id", waliId);
  return (data ?? []) as unknown as {
    id: string;
    santri: { id: string; nis: string | null; nama: string } | null;
  }[];
}

/** Cari santri untuk ditautkan ke wali. */
export async function searchSantriForWali(
  term: string,
): Promise<{ id: string; nis: string | null; nama: string }[]> {
  if (!(await canAkunWali())) return [];
  const supabase = await createClient();
  let query = supabase.from("santri").select("id, nis, nama").order("nama").limit(20);
  const t = term.replace(/[,()*]/g, " ").trim();
  if (t) query = query.or(`nama.ilike.*${t}*,nis.ilike.*${t}*`);
  const { data } = await query;
  return data ?? [];
}

export async function addSantriToWali(
  waliId: string,
  santriIds: string[],
): Promise<FormResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };
  if (santriIds.length === 0) return { ok: false, error: "Pilih santri." };

  const supabase = await createClient();
  const rows = santriIds.map((santri_id) => ({ wali_id: waliId, santri_id }));
  const { error } = await supabase
    .from("wali_santri")
    .upsert(rows, { onConflict: "wali_id,santri_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function removeSantriFromWali(
  waliSantriId: string,
): Promise<FormResult> {
  if (!(await canAkunWali())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("wali_santri")
    .delete()
    .eq("id", waliSantriId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
