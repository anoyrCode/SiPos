import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_PERMS,
  homePathForProfile,
  type Perms,
  type Role,
} from "@/lib/auth/roles";

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
  roleName: string;
  /** Nama tampilan (pegawai/wali tertaut) — fallback ke email. */
  name: string;
  pegawai_id: string | null;
  wali_id: string | null;
  perms: Perms;
};

type AppRoleRow = {
  nama: string;
  is_super: boolean;
  perm_input_poin: boolean;
  perm_laporan: boolean;
  perm_master: boolean;
  perm_akun: boolean;
  perm_kesehatan: boolean;
  scope_kelas: boolean;
  perm_santri: boolean;
  perm_pegawai: boolean;
  perm_akun_staff: boolean;
} | null;

function resolvePerms(role: Role, r: AppRoleRow): Perms {
  if (role === "wali") return EMPTY_PERMS;
  const isSuper = !!r?.is_super || role === "admin";
  if (isSuper) {
    return {
      super: true,
      input_poin: true,
      laporan: true,
      master: true,
      akun: true,
      kesehatan: true,
      scope_kelas: false,
      santri: true,
      pegawai: true,
      akun_staff: true,
    };
  }
  return {
    super: false,
    input_poin: !!r?.perm_input_poin,
    laporan: !!r?.perm_laporan,
    master: !!r?.perm_master,
    akun: !!r?.perm_akun,
    kesehatan: !!r?.perm_kesehatan,
    scope_kelas: !!r?.scope_kelas,
    santri: !!r?.perm_santri,
    pegawai: !!r?.perm_pegawai,
    akun_staff: !!r?.perm_akun_staff,
  };
}

/** User Supabase terverifikasi (atau null). Di-memoize per render pass. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Profil + hak akses user saat ini, atau null bila belum login. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, email, role, pegawai_id, wali_id, app_role:app_role(nama, is_super, perm_input_poin, perm_laporan, perm_master, perm_akun, perm_kesehatan, scope_kelas, perm_santri, perm_pegawai, perm_akun_staff), pegawai:pegawai(nama), wali:wali(nama)",
    )
    .eq("id", user.id)
    .single();

  if (!data) return null;

  type NamaEmbed = { nama: string | null } | { nama: string | null }[] | null;
  const embedNama = (e: NamaEmbed): string | null =>
    e ? (Array.isArray(e) ? (e[0]?.nama ?? null) : e.nama) : null;

  const row = data as unknown as {
    id: string;
    email: string | null;
    role: Role;
    pegawai_id: string | null;
    wali_id: string | null;
    app_role: AppRoleRow | AppRoleRow[];
    pegawai: NamaEmbed;
    wali: NamaEmbed;
  };
  const appRole = Array.isArray(row.app_role) ? row.app_role[0] : row.app_role;
  const fallbackName =
    row.role === "admin"
      ? "Administrator"
      : row.role === "wali"
        ? "Wali Santri"
        : "Pegawai";

  const linkedName =
    embedNama(row.pegawai) ?? embedNama(row.wali) ?? null;
  const name = linkedName || row.email?.split("@")[0] || "Pengguna";

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    roleName: appRole?.nama ?? fallbackName,
    name,
    pegawai_id: row.pegawai_id,
    wali_id: row.wali_id,
    perms: resolvePerms(row.role, appRole ?? null),
  };
});

/** True bila user saat ini administrator (akses penuh). */
export async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.super ?? false;
}

/** True bila boleh mengelola master data. */
export async function canMaster(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.master ?? false;
}

/** True bila boleh input poin. */
export async function canInputPoin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.input_poin ?? false;
}

/** True bila boleh lihat riwayat & laporan. */
export async function canLaporan(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.laporan ?? false;
}

/** True bila boleh mengelola akun & peran. */
export async function canAkun(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.akun ?? false;
}

/** True bila boleh mengelola data santri (master penuh atau perm khusus santri). */
export async function canSantri(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.master || profile?.perms.santri) ?? false;
}

/** True bila boleh mengelola data pegawai (master penuh atau perm khusus pegawai). */
export async function canPegawai(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.master || profile?.perms.pegawai) ?? false;
}

/** True bila boleh mengelola akun staff (akun penuh atau perm khusus akun staff). */
export async function canAkunStaff(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.akun || profile?.perms.akun_staff) ?? false;
}

/** True bila boleh mengelola rekam medis (UKS). */
export async function canKesehatan(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.kesehatan ?? false;
}

/** Wajib login; jika tidak → redirect ke /login. */
export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Wajib salah satu peran dasar (mis. "wali"); jika tidak → redirect ke beranda. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireAuth();
  if (!roles.includes(profile.role)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** Wajib staff internal (punya hak akses apa pun selain wali). */
export async function requireStaff(): Promise<Profile> {
  const profile = await requireAuth();
  const p = profile.perms;
  const hasAny =
    p.super ||
    p.input_poin ||
    p.laporan ||
    p.master ||
    p.akun ||
    p.kesehatan ||
    p.santri ||
    p.pegawai ||
    p.akun_staff;
  if (profile.role === "wali" || !hasAny) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** Wajib memiliki hak akses tertentu; jika tidak → redirect ke beranda. */
export async function requirePerm(
  perm: keyof Omit<Perms, "scope_kelas">,
): Promise<Profile> {
  const profile = await requireAuth();
  if (!profile.perms[perm]) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}
