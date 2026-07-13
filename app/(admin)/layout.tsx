import { requireAuth } from "@/lib/auth/dal";
import { homePathForProfile, navForProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { getPendingApprovalCount } from "@/lib/pending-approval";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Area admin: butuh kelola master ATAU kelola akun (atau super),
  // termasuk hak akses sempit (santri/pegawai/akun staff/akun wali/
  // dashboard/approve absensi/rekap absensi saja).
  const profile = await requireAuth();
  const p = profile.perms;
  if (
    !(
      p.master ||
      p.akun ||
      p.super ||
      p.santri ||
      p.pegawai ||
      p.akun_staff ||
      p.akun_wali ||
      p.dashboard ||
      p.approve_absensi ||
      p.rekap_absensi
    )
  ) {
    redirect(homePathForProfile(profile));
  }

  const pendingApprovalCount = await getPendingApprovalCount(
    p.master || p.super || p.approve_absensi,
  );

  return (
    <AppShell
      nav={navForProfile(profile, pendingApprovalCount)}
      name={profile.name}
      roleLabel={profile.roleName}
      jabatan={profile.jabatan}
      shift={profile.shift}
      email={profile.email}
    >
      {children}
    </AppShell>
  );
}
