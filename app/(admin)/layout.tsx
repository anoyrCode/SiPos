import { requireAuth } from "@/lib/auth/dal";
import { homePathForProfile, navForProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Area admin: butuh kelola master ATAU kelola akun (atau super).
  const profile = await requireAuth();
  if (!(profile.perms.master || profile.perms.akun || profile.perms.super)) {
    redirect(homePathForProfile(profile));
  }

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
