import { requireRole } from "@/lib/auth/dal";
import { navForProfile } from "@/lib/auth/roles";
import { AppShell } from "@/components/shared/app-shell";
import { WhatsappFab } from "@/components/shared/whatsapp-fab";

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
      jabatan={profile.jabatan}
      shift={profile.shift}
      email={profile.email}
    >
      {children}
      <WhatsappFab name={profile.name} />
    </AppShell>
  );
}
