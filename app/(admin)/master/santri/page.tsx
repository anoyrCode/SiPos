import { GraduationCap, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireSantri } from "@/lib/auth/dal";
import {
  getStr,
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SantriForm } from "./santri-form";
import { deleteSantri } from "./actions";
import { SANTRI_STATUS, type SantriRow } from "./schema";

const STATUS_BADGE: Record<
  SantriRow["status"],
  { label: string; variant: "primary" | "outline" | "warning" }
> = {
  aktif: { label: "Aktif", variant: "primary" },
  lulus: { label: "Lulus", variant: "outline" },
  keluar: { label: "Keluar", variant: "warning" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSantri();
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const statusFilter = getStr(sp.status);

  const supabase = await createClient();
  let query = supabase
    .from("santri")
    .select(
      "id, nis, nisn, nama, email, jenis_kelamin, nama_ayah, nama_ibu, nama_wali, no_telp_wali, status",
      { count: "exact" },
    )
    .order("nama", { ascending: true });
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.or(`nama.ilike.*${term}*,nis.ilike.*${term}*`);
  }
  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as SantriRow[];

  const columns: Column<SantriRow>[] = [
    {
      key: "nis",
      header: "NIS",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {orDash(r.nis)}
        </span>
      ),
    },
    {
      key: "nama",
      header: "Nama",
      cell: (r) => (
        <div>
          <span className="font-medium">{r.nama}</span>
          {r.jenis_kelamin && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({r.jenis_kelamin === "L" ? "L" : "P"})
            </span>
          )}
        </div>
      ),
    },
    {
      key: "wali",
      header: "Wali",
      cell: (r) => (
        <div>
          <span>{orDash(r.nama_wali)}</span>
          {r.no_telp_wali && (
            <p className="font-mono text-xs text-muted-foreground">
              {r.no_telp_wali}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        const s = STATUS_BADGE[r.status];
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <SantriForm initial={r} />
          <ConfirmDialog
            action={deleteSantri}
            id={r.id}
            title="Hapus santri?"
            description={`"${r.nama}" akan dihapus permanen, termasuk rekam medisnya. (Santri dengan riwayat poin tidak bisa dihapus.)`}
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
        icon={GraduationCap}
        title="Data Santri"
        description="Kelola data santri."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama atau NIS…" />
        <FilterSelect
          param="status"
          placeholder="Status"
          allLabel="Semua status"
          options={SANTRI_STATUS.map((s) => ({
            value: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          }))}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SantriForm />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q || !!statusFilter}
        empty="Belum ada data santri."
        emptyHint="Tambah santri dengan tombol di atas."
      />
      <Pagination
        page={page}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
