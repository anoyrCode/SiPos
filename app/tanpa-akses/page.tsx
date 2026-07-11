import { requireAuth } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

/**
 * Fallback aman untuk akun yang belum punya hak akses apapun (role belum
 * ter-assign / app_role_id kosong). Sengaja di luar layout (app)/(admin)
 * yang mensyaratkan hak akses — supaya tidak jadi redirect loop ke diri
 * sendiri (homePathForProfile jatuh ke sini justru saat semua perm false).
 */
export default async function TanpaAksesPage() {
  const profile = await requireAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold">Belum Ada Hak Akses</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Akun <span className="font-medium">{profile.name}</span> belum memiliki hak
          akses ke menu manapun. Hubungi admin untuk mengatur peran akun ini.
        </p>
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Keluar
        </Button>
      </form>
    </main>
  );
}
