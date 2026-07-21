import { Download, History, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import {
  getStr,
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { formatDateID, orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangeFilter } from "./date-range-filter";
import { EditTransaksiDialog } from "./edit-transaksi-dialog";
import { deleteTransaksi } from "./actions";

type Row = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  is_override: boolean;
  tanggal_kejadian: string;
  catatan: string | null;
  santri: { nama: string; nis: string | null } | null;
  master_poin: { kode_poin: string; nama_poin: string } | null;
  pegawai: { nama: string } | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const tipe = getStr(sp.tipe);
  const taId = getStr(sp.ta);
  const dateFrom = getStr(sp.from);
  const dateTo = getStr(sp.to);

  const exportParams = new URLSearchParams();
  if (tipe) exportParams.set("tipe", tipe);
  if (taId) exportParams.set("ta", taId);
  if (dateFrom) exportParams.set("from", dateFrom);
  if (dateTo) exportParams.set("to", dateTo);
  if (q) exportParams.set("q", q);
  const exportHref = `/api/export/riwayat-poin?${exportParams.toString()}`;

  const profile = await getProfile();
  const isAdminUser = profile?.perms.super ?? false;

  if (!profile?.perms.laporan) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Anda tidak memiliki hak akses untuk melihat riwayat poin.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  // Tiga blok di bawah ini independen satu sama lain — hasilnya baru
  // digabung sesudahnya — dijalankan paralel lewat Promise.all.
  const [{ data: taData }, scopedSantriIds, santriIds] = await Promise.all([
    supabase
      .from("tahun_ajaran")
      .select("id, tahun")
      .order("tahun", { ascending: false }),

    // Peran ter-scope (mis. musyrif/musyrifah): batasi riwayat ke santri di
    // kelas yang ditugaskan ke pegawai ini (lintas tahun ajaran — kelas_id
    // sudah unik per tahun ajaran, jadi otomatis cuma cocok di tahun yang
    // relevan tanpa perlu filter TA terpisah di sini).
    (async (): Promise<string[] | null> => {
      if (!(profile.perms.scope_kelas && !profile.perms.super && profile.pegawai_id)) {
        return null;
      }
      const { data: gk } = await supabase
        .from("guru_kelas")
        .select("kelas_id")
        .eq("pegawai_id", profile.pegawai_id);
      const kelasIds = [...new Set((gk ?? []).map((r) => r.kelas_id))];
      if (kelasIds.length === 0) return [];
      const { data: sk } = await supabase
        .from("santri_kelas")
        .select("santri_id")
        .in("kelas_id", kelasIds);
      return [...new Set((sk ?? []).map((r) => r.santri_id))];
    })(),

    // Pencarian santri → daftar id (filter transaksi)
    (async (): Promise<string[] | null> => {
      if (!q) return null;
      const t = q.replace(/[,()*]/g, " ").trim();
      if (!t) return null;
      const { data: s } = await supabase
        .from("santri")
        .select("id")
        .or(`nama.ilike.*${t}*,nis.ilike.*${t}*`)
        .limit(200);
      const ids = (s ?? []).map((x) => x.id);
      return ids.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : ids;
    })(),
  ]);
  const taOptions = (taData ?? []).map((t) => ({ value: t.id, label: t.tahun }));

  // Gabungkan filter pencarian & scope kelas (irisan kalau dua-duanya aktif).
  let effectiveSantriIds: string[] | null = santriIds;
  if (scopedSantriIds) {
    effectiveSantriIds = santriIds
      ? santriIds.filter((id) => scopedSantriIds!.includes(id))
      : scopedSantriIds;
    if (effectiveSantriIds.length === 0) {
      effectiveSantriIds = ["00000000-0000-0000-0000-000000000000"];
    }
  }

  let query = supabase
    .from("transaksi_poin")
    .select(
      "id, tipe, nilai_poin, is_override, tanggal_kejadian, catatan, santri:santri(nama, nis), master_poin:master_poin(kode_poin, nama_poin), pegawai:pegawai(nama)",
      { count: "exact" },
    )
    .order("tanggal_kejadian", { ascending: false })
    .order("created_at", { ascending: false });
  if (tipe) query = query.eq("tipe", tipe);
  if (taId) query = query.eq("tahun_ajaran_id", taId);
  if (dateFrom) query = query.gte("tanggal_kejadian", dateFrom);
  if (dateTo) query = query.lte("tanggal_kejadian", dateTo);
  if (effectiveSantriIds) query = query.in("santri_id", effectiveSantriIds);

  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateID(r.tanggal_kejadian)}
        </span>
      ),
    },
    {
      key: "santri",
      header: "Santri",
      cell: (r) => (
        <div>
          <span className="font-medium">{r.santri?.nama ?? "—"}</span>
          {r.santri?.nis && (
            <p className="font-mono text-xs text-muted-foreground">
              {r.santri.nis}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "poin",
      header: "Poin",
      cell: (r) => (
        <div>
          <span>{r.master_poin?.nama_poin ?? "—"}</span>
          {r.master_poin?.kode_poin && (
            <span className="ml-1 font-mono text-xs text-muted-foreground">
              ({r.master_poin.kode_poin})
            </span>
          )}
        </div>
      ),
    },
    {
      key: "nilai",
      header: "Nilai",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Badge variant={r.tipe === "POSITIF" ? "positive" : "negative"} className="font-mono">
            {r.tipe === "POSITIF" ? "+" : "−"}
            {r.nilai_poin}
          </Badge>
          {r.is_override && (
            <span className="text-[10px] uppercase text-warning">override</span>
          )}
        </div>
      ),
    },
    {
      key: "pencatat",
      header: "Pencatat",
      cell: (r) => (
        <span className="text-muted-foreground">{orDash(r.pegawai?.nama)}</span>
      ),
    },
    {
      key: "catatan",
      header: "Catatan",
      cell: (r) => (
        <span className="block max-w-[16rem] truncate text-muted-foreground">
          {orDash(r.catatan)}
        </span>
      ),
    },
    ...(isAdminUser
      ? [
          {
            key: "aksi",
            header: <span className="sr-only">Aksi</span>,
            headClassName: "text-right",
            className: "text-right",
            cell: (r: Row) => (
              <div className="flex justify-end">
                <EditTransaksiDialog
                  id={r.id}
                  santriNama={r.santri?.nama ?? "—"}
                  poinNama={r.master_poin?.nama_poin ?? "—"}
                  initial={{
                    tanggal_kejadian: r.tanggal_kejadian,
                    nilai_poin: r.nilai_poin,
                    catatan: r.catatan ?? "",
                  }}
                />
                <ConfirmDialog
                  action={deleteTransaksi}
                  id={r.id}
                  title="Hapus transaksi poin?"
                  description="Transaksi ini akan dihapus permanen."
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            ),
          } satisfies Column<Row>,
        ]
      : []),
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          icon={History}
          title="Riwayat Poin"
          description={
            isAdminUser
              ? "Semua transaksi poin santri."
              : "Riwayat transaksi poin (hanya lihat)."
          }
        />
        <Button asChild variant="secondary" size="sm">
          <a href={exportHref}>
            <Download data-icon="inline-start" />
            Unduh Excel
          </a>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari santri (nama/NIS)…" />
        <FilterSelect
          param="tipe"
          placeholder="Jenis"
          allLabel="Semua jenis"
          options={[
            { value: "POSITIF", label: "Positif" },
            { value: "NEGATIF", label: "Negatif" },
          ]}
        />
        <FilterSelect
          param="ta"
          placeholder="Tahun ajaran"
          allLabel="Semua tahun ajaran"
          options={taOptions}
        />
        <DateRangeFilter />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        empty="Belum ada transaksi poin."
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
