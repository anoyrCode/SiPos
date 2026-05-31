import { requireRole } from "@/lib/auth/dal";
import { navForProfile } from "@/lib/auth/roles";
import { AppShell } from "@/components/shared/app-shell";

export default async function WaliLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("wali");

  return (
    <AppShell
      nav={navForProfile(profile)}
      name={profile.name}
      roleLabel={profile.roleName}
      email={profile.email}
    >
      {children}
    </AppShell>
  );
}
