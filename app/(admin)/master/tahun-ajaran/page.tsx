import { CalendarDays, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { formatDateID } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TahunAjaranForm, type TahunAjaranRow } from "./tahun-ajaran-form";
import { ActivateButton } from "./activate-button";
import { deleteTahunAjaran } from "./actions";

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
    .from("tahun_ajaran")
    .select("id, tahun, tanggal_mulai, tanggal_selesai, is_aktif", {
      count: "exact",
    })
    .order("tahun", { ascending: false });
  if (q) query = query.ilike("tahun", `%${q}%`);
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as TahunAjaranRow[];

  const columns: Column<TahunAjaranRow>[] = [
    {
      key: "tahun",
      header: "Tahun Ajaran",
      cell: (r) => <span className="font-medium">{r.tahun}</span>,
    },
    {
      key: "periode",
      header: "Periode",
      cell: (r) => (
        <span className="text-muted-foreground">
          {formatDateID(r.tanggal_mulai)} – {formatDateID(r.tanggal_selesai)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) =>
        r.is_aktif ? (
          <Badge variant="primary">Aktif</Badge>
        ) : (
          <Badge variant="outline">Nonaktif</Badge>
        ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {!r.is_aktif && <ActivateButton id={r.id} />}
          <TahunAjaranForm initial={r} />
          <ConfirmDialog
            action={deleteTahunAjaran}
            id={r.id}
            title="Hapus tahun ajaran?"
            description={`"${r.tahun}" akan dihapus permanen.`}
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
        icon={CalendarDays}
        title="Tahun Ajaran"
        description="Kelola tahun ajaran. Hanya satu yang boleh aktif."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari tahun ajaran…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <TahunAjaranForm />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty="Belum ada tahun ajaran."
        emptyHint="Tambah tahun ajaran dengan tombol di atas."
      />
      <Pagination
        page={page}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
