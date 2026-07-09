import { requireStaff } from "@/lib/auth/dal";
import { navForProfile } from "@/lib/auth/roles";
import { AppShell } from "@/components/shared/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Modul transaksi: semua staff internal (gating per-halaman menyusul).
  const profile = await requireStaff();

  return (
    <AppShell
      nav={navForProfile(profile)}
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
