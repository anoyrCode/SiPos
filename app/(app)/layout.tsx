import { requireStaff } from "@/lib/auth/dal";
import { navForProfile } from "@/lib/auth/roles";
import { AppShell } from "@/components/shared/app-shell";
import { getPendingApprovalCount } from "@/lib/pending-approval";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Modul transaksi: semua staff internal (gating per-halaman menyusul).
  const profile = await requireStaff();
  const p = profile.perms;
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
