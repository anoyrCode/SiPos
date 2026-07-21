import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USER_ID_HEADER } from "@/lib/supabase/proxy";
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
  /** Jabatan pegawai (mis. "Musyrif") — null bila bukan pegawai. */
  jabatan: string | null;
  /** Shift pegawai (1/2/3) — null bila belum diatur / bukan pegawai. */
  shift: 1 | 2 | 3 | null;
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
  perm_akun_wali: boolean;
  perm_absensi: boolean;
  perm_dashboard: boolean;
  perm_approve_absensi: boolean;
  perm_rekap_absensi: boolean;
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
      akun_wali: true,
      absensi: true,
      dashboard: true,
      approve_absensi: true,
      rekap_absensi: true,
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
    akun_wali: !!r?.perm_akun_wali,
    absensi: !!r?.perm_absensi,
    dashboard: !!r?.perm_dashboard,
    approve_absensi: !!r?.perm_approve_absensi,
    rekap_absensi: !!r?.perm_rekap_absensi,
  };
}

/**
 * User Supabase terverifikasi (atau null). Di-memoize per render pass.
 *
 * `proxy.ts` sudah memanggil `supabase.auth.getUser()` untuk setiap request
 * dan meneruskan hasilnya lewat header internal `USER_ID_HEADER` (tidak
 * pernah sampai ke client, tidak bisa dipalsukan — lihat `lib/supabase/proxy.ts`).
 * Header itu dipakai di sini agar tidak perlu verifikasi ulang ke Supabase Auth
 * (hemat 1 round-trip jaringan tiap request/server action). Fallback ke
 * pemanggilan asli hanya dipakai bila header tidak ada sama sekali (proxy
 * tidak sempat berjalan utk request ini).
 */
export const getUser = cache(async (): Promise<{ id: string } | null> => {
  const verifiedId = (await headers()).get(USER_ID_HEADER);
  if (verifiedId !== null) {
    return verifiedId ? { id: verifiedId } : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
});

/** Profil + hak akses user saat ini, atau null bila belum login. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, email, role, pegawai_id, wali_id, app_role:app_role(nama, is_super, perm_input_poin, perm_laporan, perm_master, perm_akun, perm_kesehatan, scope_kelas, perm_santri, perm_pegawai, perm_akun_staff, perm_akun_wali, perm_absensi, perm_dashboard, perm_approve_absensi, perm_rekap_absensi), pegawai:pegawai(nama, jabatan, shift), wali:wali(nama)",
    )
    .eq("id", user.id)
    .single();

  if (!data) return null;

  type NamaEmbed = { nama: string | null } | { nama: string | null }[] | null;
  const embedNama = (e: NamaEmbed): string | null =>
    e ? (Array.isArray(e) ? (e[0]?.nama ?? null) : e.nama) : null;

  type PegawaiRow = {
    nama: string | null;
    jabatan: string | null;
    shift: number | null;
  } | null;
  type PegawaiEmbed = PegawaiRow | PegawaiRow[];

  const row = data as unknown as {
    id: string;
    email: string | null;
    role: Role;
    pegawai_id: string | null;
    wali_id: string | null;
    app_role: AppRoleRow | AppRoleRow[];
    pegawai: PegawaiEmbed;
    wali: NamaEmbed;
  };
  const appRole = Array.isArray(row.app_role) ? row.app_role[0] : row.app_role;
  const pegawaiRow = Array.isArray(row.pegawai)
    ? (row.pegawai[0] ?? null)
    : row.pegawai;
  const fallbackName =
    row.role === "admin"
      ? "Administrator"
      : row.role === "wali"
        ? "Wali Santri"
        : "Pegawai";

  const linkedName = pegawaiRow?.nama ?? embedNama(row.wali) ?? null;
  const name = linkedName || row.email?.split("@")[0] || "Pengguna";

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    roleName: appRole?.nama ?? fallbackName,
    name,
    jabatan: pegawaiRow?.jabatan ?? null,
    shift: (pegawaiRow?.shift as 1 | 2 | 3 | null) ?? null,
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

/** True bila boleh mengelola akun wali (akun penuh atau perm khusus akun wali). */
export async function canAkunWali(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.akun || profile?.perms.akun_wali) ?? false;
}

/** True bila boleh absen (clock in/out). */
export async function canAbsensi(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.absensi ?? false;
}

/** True bila boleh mengelola rekam medis (UKS). */
export async function canKesehatan(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.perms.kesehatan ?? false;
}

/** True bila boleh lihat Dashboard (master penuh atau perm khusus dashboard). */
export async function canDashboard(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.master || profile?.perms.dashboard) ?? false;
}

/** True bila boleh approve/tolak pengajuan izin/sakit pegawai lain. */
export async function canApproveAbsensi(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.master || profile?.perms.approve_absensi) ?? false;
}

/** Wajib boleh approve absensi (master penuh atau perm khusus approve). */
export async function requireApproveAbsensi(): Promise<Profile> {
  const profile = await requireAuth();
  if (!(profile.perms.master || profile.perms.approve_absensi)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** True bila boleh lihat rekap kehadiran semua pegawai (master penuh atau perm khusus). */
export async function canRekapAbsensi(): Promise<boolean> {
  const profile = await getProfile();
  return (profile?.perms.master || profile?.perms.rekap_absensi) ?? false;
}

/** Wajib boleh akses halaman Rekap Absensi (lihat rekap, approve pengajuan, atau master). */
export async function requireRekapAbsensiAkses(): Promise<Profile> {
  const profile = await requireAuth();
  const p = profile.perms;
  if (!(p.master || p.approve_absensi || p.rekap_absensi)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
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
    p.akun_staff ||
    p.absensi ||
    p.dashboard ||
    p.approve_absensi ||
    p.rekap_absensi;
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

/** Wajib boleh kelola data santri (master penuh atau perm khusus santri). */
export async function requireSantri(): Promise<Profile> {
  const profile = await requireAuth();
  if (!(profile.perms.master || profile.perms.santri)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** Wajib boleh kelola data pegawai (master penuh atau perm khusus pegawai). */
export async function requirePegawai(): Promise<Profile> {
  const profile = await requireAuth();
  if (!(profile.perms.master || profile.perms.pegawai)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** Wajib boleh kelola akun staff (akun penuh atau perm khusus akun staff). */
export async function requireAkunStaff(): Promise<Profile> {
  const profile = await requireAuth();
  if (!(profile.perms.akun || profile.perms.akun_staff)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** Wajib boleh kelola akun wali (akun penuh atau perm khusus akun wali). */
export async function requireAkunWali(): Promise<Profile> {
  const profile = await requireAuth();
  if (!(profile.perms.akun || profile.perms.akun_wali)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}

/** Wajib boleh lihat Dashboard (master penuh atau perm khusus dashboard). */
export async function requireDashboard(): Promise<Profile> {
  const profile = await requireAuth();
  if (!(profile.perms.master || profile.perms.dashboard)) {
    redirect(homePathForProfile(profile));
  }
  return profile;
}
