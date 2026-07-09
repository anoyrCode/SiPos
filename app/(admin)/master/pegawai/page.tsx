import { Trash2, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePegawai } from "@/lib/auth/dal";
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
import { PegawaiForm } from "./pegawai-form";
import { deletePegawai } from "./actions";
import type { PegawaiRow } from "./schema";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePegawai();
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("pegawai")
    .select(
      "id, nip, nama, email, jabatan, jenis_kelamin, telp, tempat_lahir, tanggal_lahir, alamat, jam_masuk_jadwal, jam_pulang_jadwal, hari_libur",
      { count: "exact" },
    )
    .order("nama", { ascending: true });
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.or(`nama.ilike.*${term}*,nip.ilike.*${term}*`);
  }
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as PegawaiRow[];

  const columns: Column<PegawaiRow>[] = [
    {
      key: "nip",
      header: "NIP",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {orDash(r.nip)}
        </span>
      ),
    },
    {
      key: "nama",
      header: "Nama",
      cell: (r) => (
        <div>
          <span className="font-medium">{r.nama}</span>
          {r.email && (
            <p className="text-xs text-muted-foreground">{r.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "jabatan",
      header: "Jabatan",
      cell: (r) => orDash(r.jabatan),
    },
    {
      key: "jenis_kelamin",
      header: "L/P",
      cell: (r) =>
        r.jenis_kelamin ? (
          <Badge variant="outline">
            {r.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "telp",
      header: "Telepon",
      cell: (r) => (
        <span className="font-mono text-xs">{orDash(r.telp)}</span>
      ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <PegawaiForm initial={r} />
          <ConfirmDialog
            action={deletePegawai}
            id={r.id}
            title="Hapus pegawai?"
            description={`"${r.nama}" akan dihapus permanen, termasuk seluruh riwayat absensinya.`}
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
        icon={Users}
        title="Data Pegawai"
        description="Kelola data guru & pegawai."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama atau NIP…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PegawaiForm />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty="Belum ada data pegawai."
        emptyHint="Tambah pegawai dengan tombol di atas."
      />
      <Pagination
        page={page}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
