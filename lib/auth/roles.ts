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
};

export type NavItem = { href: string; label: string };
export type NavGroup = { title?: string; items: NavItem[] };

type ProfileLike = { role: Role; perms: Perms };

/** Halaman beranda default sesuai hak akses (redirect setelah login). */
export function homePathForProfile({ role, perms }: ProfileLike): string {
  if (role === "wali") return "/anak";
  if (perms.super || perms.master) return "/dashboard";
  if (perms.input_poin) return "/input-poin";
  if (perms.laporan) return "/riwayat-poin";
  if (perms.kesehatan || perms.scope_kelas) return "/uks";
  if (perms.santri || perms.pegawai) return "/master/santri";
  if (perms.akun || perms.akun_staff) return "/master/akun-staff";
  return "/input-poin"; // fallback aman (halaman menampilkan pesan bila tak berhak)
}

/** Menu navigasi sesuai hak akses. */
export function navForProfile({ role, perms }: ProfileLike): NavGroup[] {
  if (role === "wali") {
    return [{ items: [{ href: "/anak", label: "Anak Saya" }] }];
  }

  const groups: NavGroup[] = [];

  if (perms.super || perms.master) {
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
      { href: "/master/penugasan-guru", label: "Penugasan Guru" },
    );
  }
  if (masterItems.length > 0) {
    groups.push({ title: "Master Data", items: masterItems });
  }

  const akunItems: NavItem[] = [];
  if (perms.akun || perms.akun_staff)
    akunItems.push({ href: "/master/akun-staff", label: "Akun Staff" });
  if (perms.akun) {
    akunItems.push(
      { href: "/master/akun-wali", label: "Akun Wali" },
      { href: "/master/peran", label: "Peran & Hak Akses" },
    );
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
