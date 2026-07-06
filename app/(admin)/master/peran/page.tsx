import { ShieldCheck, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeranForm } from "./peran-form";
import { deletePeran } from "./actions";
import type { PeranRow } from "./schema";

const PERM_BADGES: { key: keyof PeranRow; label: string }[] = [
  { key: "perm_input_poin", label: "Input poin" },
  { key: "perm_laporan", label: "Laporan" },
  { key: "perm_master", label: "Master" },
  { key: "perm_santri", label: "Santri" },
  { key: "perm_pegawai", label: "Pegawai" },
  { key: "perm_akun", label: "Akun" },
  { key: "perm_akun_staff", label: "Akun Staff" },
  { key: "perm_absensi", label: "Absensi" },
  { key: "perm_kesehatan", label: "UKS" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("akun");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("app_role")
    .select(
      "id, nama, deskripsi, perm_input_poin, perm_laporan, perm_master, perm_akun, perm_kesehatan, scope_kelas, perm_santri, perm_pegawai, perm_akun_staff, perm_absensi, is_super",
      { count: "exact" },
    )
    .order("is_super", { ascending: false })
    .order("nama");
  if (q) query = query.ilike("nama", `%${q}%`);
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as PeranRow[];

  const columns: Column<PeranRow>[] = [
    {
      key: "nama",
      header: "Peran",
      cell: (r) => (
        <div className="flex items-center gap-2">
          {r.is_super && <ShieldCheck className="size-4 text-primary" />}
          <span className="font-medium">{r.nama}</span>
        </div>
      ),
    },
    {
      key: "deskripsi",
      header: "Deskripsi",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {orDash(r.deskripsi)}
        </span>
      ),
    },
    {
      key: "hak",
      header: "Hak Akses",
      cell: (r) =>
        r.is_super ? (
          <Badge variant="primary">Akses penuh</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {PERM_BADGES.filter((p) => r[p.key]).map((p) => (
              <Badge key={p.label} variant="outline">
                {p.label}
              </Badge>
            ))}
            {r.scope_kelas && <Badge variant="outline">Per kelas</Badge>}
            {!PERM_BADGES.some((p) => r[p.key]) && (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <PeranForm initial={r} />
          {!r.is_super && (
            <ConfirmDialog
              action={deletePeran}
              id={r.id}
              title="Hapus peran?"
              description={`"${r.nama}" akan dihapus. Hanya bisa jika tidak dipakai akun mana pun.`}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                  <Trash2 />
                </Button>
              }
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={ShieldCheck}
        title="Peran & Hak Akses"
        description="Buat peran custom dan tentukan hak aksesnya."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari peran…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PeranForm />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty="Belum ada peran."
        emptyHint="Tambah peran dengan tombol di atas."
      />
      <Pagination
        page={page}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
