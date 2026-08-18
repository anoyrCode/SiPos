import { MessageSquareHeart } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  getStr,
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { formatDateID, orDash } from "@/lib/format";
import {
  JENIS_LABEL,
  JENIS_VARIANT,
  type JenisCatatan,
} from "@/lib/catatan-harian";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/app/(app)/riwayat-poin/date-range-filter";

type Row = {
  id: string;
  tanggal: string;
  jenis: JenisCatatan;
  isi: string;
  santri: { nama: string; nis: string | null } | null;
  kelas: { nama_kelas: string } | null;
  pegawai: { nama: string } | null;
};

const SENTINEL_KOSONG = "00000000-0000-0000-0000-000000000000";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");

  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const jenisFilter = getStr(sp.jenis);
  const kelasFilter = getStr(sp.kelas);
  const dateFrom = getStr(sp.from);
  const dateTo = getStr(sp.to);

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  // Dua blok ini independen — dijalankan paralel.
  const [{ data: kelasData }, santriIds] = await Promise.all([
    ta?.id
      ? supabase
          .from("kelas")
          .select("id, nama_kelas")
          .eq("tahun_ajaran_id", ta.id)
      : Promise.resolve({ data: [] as { id: string; nama_kelas: string }[] }),

    // Pencarian diselesaikan jadi daftar id santri lebih dulu, lalu dipakai
    // menyaring catatan — pola sama seperti Riwayat Poin. Menyaring lewat
    // embed (`santri!inner`) menyulitkan paginasi server karena `count`
    // ikut terpengaruh cara embed dihitung.
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
      // Sentinel supaya pencarian tanpa hasil menghasilkan tabel kosong,
      // bukan malah menampilkan seluruh catatan karena filternya dilewati.
      return ids.length === 0 ? [SENTINEL_KOSONG] : ids;
    })(),
  ]);

  const kelasOptions = (kelasData ?? [])
    .slice()
    .sort((a, b) =>
      a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true }),
    )
    .map((k) => ({ value: k.id, label: k.nama_kelas }));

  let query = supabase
    .from("catatan_harian")
    .select(
      "id, tanggal, jenis, isi, santri:santri(nama, nis), kelas:kelas(nama_kelas), pegawai:pegawai(nama)",
      { count: "exact" },
    )
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (santriIds) query = query.in("santri_id", santriIds);
  if (kelasFilter) query = query.eq("kelas_id", kelasFilter);
  if (jenisFilter) query = query.eq("jenis", jenisFilter);
  if (dateFrom) query = query.gte("tanggal", dateFrom);
  if (dateTo) query = query.lte("tanggal", dateTo);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const isFiltered = Boolean(q || jenisFilter || kelasFilter || dateFrom || dateTo);

  const columns: Column<Row>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      className: "whitespace-nowrap text-xs",
      cell: (r) => formatDateID(r.tanggal),
    },
    {
      key: "santri",
      header: "Santri",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{orDash(r.santri?.nama)}</p>
          {r.santri?.nis && (
            <p className="font-mono text-xs text-muted-foreground">{r.santri.nis}</p>
          )}
        </div>
      ),
    },
    {
      key: "kelas",
      header: "Kelas",
      className: "whitespace-nowrap text-sm",
      cell: (r) => orDash(r.kelas?.nama_kelas),
    },
    {
      key: "jenis",
      header: "Jenis",
      className: "whitespace-nowrap",
      cell: (r) => (
        <Badge variant={JENIS_VARIANT[r.jenis]}>{JENIS_LABEL[r.jenis]}</Badge>
      ),
    },
    {
      key: "isi",
      header: "Catatan",
      className: "text-sm",
      cell: (r) => <p className="max-w-md whitespace-pre-line">{r.isi}</p>,
    },
    {
      key: "penulis",
      header: "Ditulis oleh",
      className: "whitespace-nowrap text-sm",
      cell: (r) => orDash(r.pegawai?.nama),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={MessageSquareHeart}
        title="Rekap Catatan Harian"
        description="Semua kabar harian santri dari seluruh kelas, terbaru di atas."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama / NIS santri…" />
        <FilterSelect
          param="kelas"
          placeholder="Kelas"
          allLabel="Semua kelas"
          options={kelasOptions}
        />
        <FilterSelect
          param="jenis"
          placeholder="Jenis"
          allLabel="Semua jenis"
          options={[
            { value: "baik", label: JENIS_LABEL.baik },
            { value: "perhatian", label: JENIS_LABEL.perhatian },
            { value: "info", label: JENIS_LABEL.info },
          ]}
        />
        <DateRangeFilter />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={isFiltered}
        empty="Belum ada catatan harian."
        emptyHint="Catatan ditulis musyrif lewat menu Catatan Harian."
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
