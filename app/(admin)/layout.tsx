import { requireAuth } from "@/lib/auth/dal";
import { homePathForProfile, navForProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Area admin: butuh kelola master ATAU kelola akun (atau super),
  // termasuk hak akses sempit (santri/pegawai/akun staff saja).
  const profile = await requireAuth();
  const p = profile.perms;
  if (
    !(p.master || p.akun || p.super || p.santri || p.pegawai || p.akun_staff)
  ) {
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
