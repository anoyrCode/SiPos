export type Role = "admin" | "pegawai" | "wali";

/** Hak akses efektif user (diturunkan dari peran/`app_role`). */
export type Perms = {
  super: boolean; // administrator (akses penuh)
  input_poin: boolean;
  laporan: boolean;
  master: boolean;
  akun: boolean;
  kesehatan: boolean; // kelola rekam medis (UKS)
  scope_kelas: boolean; // input poin hanya kelas yang ditugaskan
  santri: boolean; // kelola data santri saja (subset dari master)
  pegawai: boolean; // kelola data pegawai saja (subset dari master)
  akun_staff: boolean; // kelola akun staff saja (subset dari akun)
  akun_wali: boolean; // kelola akun wali saja (subset dari akun)
  absensi: boolean; // clock in/out kehadiran pribadi
  dashboard: boolean; // lihat Dashboard saja (subset dari master)
  approve_absensi: boolean; // approve/tolak pengajuan izin/sakit pegawai lain
  rekap_absensi: boolean; // lihat rekap kehadiran semua pegawai (subset dari master)
};

export const EMPTY_PERMS: Perms = {
  super: false,
  input_poin: false,
  laporan: false,
  master: false,
  akun: false,
  kesehatan: false,
  scope_kelas: false,
  santri: false,
  pegawai: false,
  akun_staff: false,
  akun_wali: false,
  absensi: false,
  dashboard: false,
  approve_absensi: false,
  rekap_absensi: false,
};

export type NavItem = { href: string; label: string; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };

type ProfileLike = { role: Role; perms: Perms };

/** Halaman beranda default sesuai hak akses (redirect setelah login). */
export function homePathForProfile({ role, perms }: ProfileLike): string {
  if (role === "wali") return "/anak";
  if (perms.super || perms.master || perms.dashboard) return "/dashboard";
  if (perms.input_poin) return "/input-poin";
  if (perms.laporan) return "/riwayat-poin";
  if (perms.kesehatan || perms.scope_kelas) return "/uks";
  if (perms.santri || perms.pegawai) return "/master/santri";
  if (perms.akun || perms.akun_staff) return "/master/akun-staff";
  if (perms.akun_wali) return "/master/akun-wali";
  if (perms.approve_absensi || perms.rekap_absensi) return "/rekap-absensi";
  if (perms.absensi) return "/absensi";
  return "/tanpa-akses"; // tidak ada hak akses sama sekali — di luar layout (app), cegah redirect loop
}

/** Menu navigasi sesuai hak akses. `pendingApprovalCount` opsional — tampil sbg badge di "Rekap Absensi". */
export function navForProfile(
  { role, perms }: ProfileLike,
  pendingApprovalCount = 0,
): NavGroup[] {
  if (role === "wali") {
    return [{ items: [{ href: "/anak", label: "Anak Saya" }] }];
  }

  const groups: NavGroup[] = [];

  if (perms.super || perms.master || perms.dashboard) {
    groups.push({ items: [{ href: "/dashboard", label: "Dashboard" }] });
  }

  const transaksi: NavItem[] = [];
  if (perms.input_poin)
    transaksi.push({ href: "/input-poin", label: "Input Poin" });
  if (perms.laporan) {
    transaksi.push({ href: "/riwayat-poin", label: "Riwayat Poin" });
    transaksi.push({ href: "/laporan", label: "Laporan" });
    transaksi.push({ href: "/surat-panggilan", label: "Surat Panggilan" });
  }
  if (perms.absensi) transaksi.push({ href: "/absensi", label: "Absensi" });
  if (perms.master || perms.approve_absensi || perms.rekap_absensi)
    transaksi.push({
      href: "/rekap-absensi",
      label: "Rekap Absensi",
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
    });
  if (transaksi.length > 0) {
    groups.push({ title: "Transaksi", items: transaksi });
  }

  const masterItems: NavItem[] = [];
  if (perms.master || perms.santri) masterItems.push({ href: "/master/santri", label: "Santri" });
  if (perms.master || perms.pegawai) masterItems.push({ href: "/master/pegawai", label: "Pegawai" });
  if (perms.master) {
    masterItems.push(
      { href: "/master/poin-positif", label: "Poin Positif" },
      { href: "/master/poin-negatif", label: "Poin Negatif" },
      { href: "/master/level-poin", label: "Level Poin" },
      { href: "/master/kelas", label: "Kelas" },
      { href: "/master/level-pendidikan", label: "Level Pendidikan" },
      { href: "/master/tahun-ajaran", label: "Tahun Ajaran" },
      { href: "/master/kelas-wali", label: "Kelas & Wali" },
      { href: "/master/penugasan-guru", label: "Penugasan Musyrif" },
    );
  }
  if (masterItems.length > 0) {
    groups.push({ title: "Master Data", items: masterItems });
  }

  const akunItems: NavItem[] = [];
  if (perms.akun || perms.akun_staff)
    akunItems.push({ href: "/master/akun-staff", label: "Akun Staff" });
  if (perms.akun || perms.akun_wali)
    akunItems.push({ href: "/master/akun-wali", label: "Akun Wali" });
  if (perms.akun) {
    akunItems.push({ href: "/master/peran", label: "Peran & Hak Akses" });
  }
  if (akunItems.length > 0) {
    groups.push({ title: "Akun & Peran", items: akunItems });
  }

  if (perms.kesehatan || perms.scope_kelas) {
    groups.push({
      title: "Kesehatan",
      items: [{ href: "/uks", label: "Rekam Medis" }],
    });
  }

  return groups;
}
