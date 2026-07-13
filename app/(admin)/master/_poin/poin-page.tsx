import { ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

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
import { PoinForm } from "./poin-form";
import { deletePoin } from "./actions";
import type { PoinRow, PoinTipe } from "./schema";

export async function PoinPage({
  tipe,
  searchParams,
}: {
  tipe: PoinTipe;
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const isPos = tipe === "POSITIF";

  const supabase = await createClient();
  let query = supabase
    .from("master_poin")
    .select(
      "id, kode_poin, nama_poin, deskripsi_poin, nilai_poin, level, keterangan, is_aktif",
      { count: "exact" },
    )
    .eq("tipe", tipe)
    .order("kode_poin", { ascending: true });
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.or(`kode_poin.ilike.*${term}*,nama_poin.ilike.*${term}*`);
  }
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as PoinRow[];

  // Kode poin berikutnya (otomatis): cari nomor terbesar utk tipe ini lalu +1.
  const { data: allKode } = await supabase
    .from("master_poin")
    .select("kode_poin")
    .eq("tipe", tipe);
  const prefix = isPos ? "P" : "N";
  const maxNum = (allKode ?? []).reduce((m, r) => {
    const match = /^[PN]-(\d+)$/i.exec(r.kode_poin ?? "");
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  const nextKode = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;

  // Level untuk tipe ini (dikelola di Master → Level Poin).
  const { data: levelData } = await supabase
    .from("master_level_poin")
    .select("nama")
    .eq("tipe", tipe)
    .order("urutan", { ascending: true });
  const levels = (levelData ?? []).map((l) => l.nama as string);

  const columns: Column<PoinRow>[] = [
    {
      key: "kode_poin",
      header: "Kode",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.kode_poin}
        </span>
      ),
    },
    {
      key: "nama_poin",
      header: "Nama Poin",
      cell: (r) => (
        <div>
          <span className="font-medium">{r.nama_poin}</span>
          {r.deskripsi_poin && (
            <p className="max-w-xs truncate text-xs text-muted-foreground">
              {r.deskripsi_poin}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "nilai_poin",
      header: "Nilai",
      cell: (r) => (
        <Badge variant={isPos ? "positive" : "negative"} className="font-mono">
          {isPos ? "+" : "−"}
          {r.nilai_poin}
        </Badge>
      ),
    },
    {
      key: "level",
      header: "Level",
      cell: (r) =>
        r.level ? (
          <Badge variant="outline">{r.level}</Badge>
        ) : (
          <span className="text-muted-foreground">{orDash(r.level)}</span>
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
          <PoinForm tipe={tipe} initial={r} levels={levels} />
          <ConfirmDialog
            action={deletePoin.bind(null, tipe)}
            id={r.id}
            title="Nonaktifkan poin?"
            description={`"${r.nama_poin}" akan dinonaktifkan (histori transaksi tetap aman).`}
            confirmLabel="Nonaktifkan"
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Nonaktifkan">
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
        icon={isPos ? ThumbsUp : ThumbsDown}
        title={isPos ? "Poin Positif" : "Poin Negatif"}
        description={
          isPos
            ? "Daftar penghargaan/poin positif santri."
            : "Daftar pelanggaran/poin negatif santri."
        }
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari kode atau nama poin…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PoinForm tipe={tipe} nextKode={nextKode} levels={levels} />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty={isPos ? "Belum ada poin positif." : "Belum ada poin negatif."}
        emptyHint="Tambah item poin dengan tombol di atas."
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
