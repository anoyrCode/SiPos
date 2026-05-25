import { Trash2, UserCog } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePerm } from "@/lib/auth/dal";
import {
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaffAccountForm } from "./account-form";
import { ResetPasswordDialog } from "./reset-password";
import { deleteStaffAccount } from "./actions";

type Embed = { nama: string } | { nama: string }[] | null;
function embedNama(e: Embed): string | null {
  if (!e) return null;
  return Array.isArray(e) ? (e[0]?.nama ?? null) : e.nama;
}

type AccountRow = {
  id: string;
  email: string | null;
  role: string;
  app_role_id: string | null;
  pegawai_id: string | null;
  app_role: Embed;
  pegawai: Embed;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("akun");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select(
      "id, email, role, app_role_id, pegawai_id, app_role:app_role(nama), pegawai:pegawai(nama)",
      { count: "exact" },
    )
    .neq("role", "wali")
    .order("email");
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.ilike("email", `%${term}%`);
  }
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as unknown as AccountRow[];

  const [{ data: roleData }, { data: pegData }] = await Promise.all([
    admin
      .from("app_role")
      .select("id, nama")
      .eq("is_aktif", true)
      .order("is_super", { ascending: false })
      .order("nama"),
    admin.from("pegawai").select("id, nama, email").order("nama"),
  ]);
  const roles = roleData ?? [];
  const pegawai = pegData ?? [];

  const columns: Column<AccountRow>[] = [
    {
      key: "email",
      header: "Email",
      cell: (r) => <span className="font-medium">{r.email ?? "—"}</span>,
    },
    {
      key: "peran",
      header: "Peran",
      cell: (r) => {
        const nama = embedNama(r.app_role) ?? (r.role === "admin" ? "Administrator" : null);
        return nama ? (
          <Badge variant="primary">{nama}</Badge>
        ) : (
          <Badge variant="outline">Belum ada peran</Badge>
        );
      },
    },
    {
      key: "pegawai",
      header: "Pegawai",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {embedNama(r.pegawai) ?? "—"}
        </span>
      ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <StaffAccountForm
            roles={roles}
            pegawai={pegawai}
            initial={{
              userId: r.id,
              email: r.email,
              app_role_id: r.app_role_id,
              pegawai_id: r.pegawai_id,
            }}
          />
          <ResetPasswordDialog userId={r.id} email={r.email} />
          <ConfirmDialog
            action={deleteStaffAccount}
            id={r.id}
            title="Hapus akun staff?"
            description={`Akun "${r.email ?? ""}" akan dihapus permanen. Data pegawai tetap ada.`}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                <Trash2 />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={UserCog}
        title="Akun Staff"
        description="Buat akun login untuk admin, guru/musyrif, dan pegawai lalu tetapkan perannya."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari email…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StaffAccountForm roles={roles} pegawai={pegawai} />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        empty="Belum ada akun staff."
      />
      <Pagination
        page={page}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
