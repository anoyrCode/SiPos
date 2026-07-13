import { redirect } from "next/navigation";
import { HeartPulse, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { homePathForProfile } from "@/lib/auth/roles";
import {
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { formatDateID, orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { RekamForm } from "./rekam-form";
import { deleteRekam } from "./actions";
import type { RekamRow } from "./schema";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const canWrite = profile.perms.kesehatan || profile.perms.super;
  if (!(canWrite || profile.perms.scope_kelas)) {
    redirect(homePathForProfile(profile));
  }

  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("rekam_medis")
    .select(
      "id, tanggal, keluhan, tindakan, obat, catatan, santri:santri!inner(nama, nis), petugas:pegawai(nama)",
      { count: "exact" },
    )
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.ilike("santri.nama", `%${term}%`);
  }
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as unknown as RekamRow[];

  const columns: Column<RekamRow>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {formatDateID(r.tanggal)}
        </span>
      ),
    },
    {
      key: "santri",
      header: "Santri",
      cell: (r) => <span className="font-medium">{r.santri?.nama ?? "—"}</span>,
    },
    {
      key: "keluhan",
      header: "Keluhan",
      cell: (r) => <span className="text-sm">{r.keluhan}</span>,
    },
    {
      key: "tindakan",
      header: "Tindakan",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {orDash(r.tindakan)}
        </span>
      ),
    },
    {
      key: "petugas",
      header: "Petugas",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {orDash(r.petugas?.nama)}
        </span>
      ),
    },
  ];

  if (canWrite) {
    columns.push({
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <RekamForm initial={r} />
          <ConfirmDialog
            action={deleteRekam}
            id={r.id}
            title="Hapus catatan kunjungan?"
            description={`Catatan UKS "${r.santri?.nama ?? ""}" (${formatDateID(r.tanggal)}) akan dihapus.`}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                <Trash2 />
              </Button>
            }
          />
        </div>
      ),
    });
  }

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={HeartPulse}
        title="Rekam Medis (UKS)"
        description={
          canWrite
            ? "Catat & lihat kunjungan santri ke UKS."
            : "Lihat kunjungan UKS santri di kelas Anda."
        }
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama santri…" />
        {canWrite && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <RekamForm />
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        empty="Belum ada catatan kunjungan UKS."
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
