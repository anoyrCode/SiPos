import { Layers, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
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
import { Button } from "@/components/ui/button";
import { LevelForm, type LevelRow } from "./level-form";
import { deleteLevel } from "./actions";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("level_pendidikan")
    .select("id, nama, urutan", { count: "exact" })
    .order("urutan", { ascending: true });
  if (q) query = query.ilike("nama", `%${q}%`);
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as LevelRow[];

  const columns: Column<LevelRow>[] = [
    {
      key: "nama",
      header: "Nama",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "urutan",
      header: "Urutan",
      cell: (r) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {r.urutan}
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
          <LevelForm initial={r} />
          <ConfirmDialog
            action={deleteLevel}
            id={r.id}
            title="Hapus level pendidikan?"
            description={`"${r.nama}" akan dihapus permanen.`}
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
        icon={Layers}
        title="Level Pendidikan"
        description="Kelola jenjang pendidikan (SD, MTS, SMA)."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari level…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LevelForm />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty="Belum ada level pendidikan."
        emptyHint="Tambah level dengan tombol di atas."
      />
      <Pagination
        page={page}
        perPage={perPage}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
