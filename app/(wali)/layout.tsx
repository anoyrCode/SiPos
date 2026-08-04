import { requireRole } from "@/lib/auth/dal";
import { navForProfile } from "@/lib/auth/roles";
import { AppShell } from "@/components/shared/app-shell";
import { BottomNav } from "@/components/shared/bottom-nav";
import { WhatsappFab } from "@/components/shared/whatsapp-fab";

export default async function WaliLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("wali");
  const nav = navForProfile(profile);

  return (
    <AppShell
      nav={nav}
      name={profile.name}
      roleLabel={profile.roleName}
      jabatan={profile.jabatan}
      shift={profile.shift}
      email={profile.email}
      bottomNav={<BottomNav items={nav[0].items} />}
    >
      {children}
      <WhatsappFab name={profile.name} />
    </AppShell>
  );
}
