import { MessageSquareHeart, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRekapCatatanHarianAkses } from "@/lib/auth/dal";
import { todayJakarta } from "@/lib/absensi-status";
import {
  getStr,
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { formatDateID, orDash, tanggalWib } from "@/lib/format";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/app/(app)/riwayat-poin/date-range-filter";
import { EditCatatanDialog } from "./edit-catatan-dialog";
import { hapusCatatanAdmin } from "./actions";

type Row = {
  id: string;
  tanggal: string;
  jenis: JenisCatatan;
  isi: string;
  santri: { nama: string; nis: string | null } | null;
  kelas: { nama_kelas: string } | null;
  // Dua embed ke tabel `pegawai` — WAJIB disebut kolomnya di query. Sejak
  // kolom `disunting_oleh` ada, `catatan_harian` punya dua foreign key ke
  // `pegawai`, sehingga embed polos `pegawai:pegawai(nama)` menjadi ambigu
  // dan ditolak PostgREST. Alias lama `pegawai` diganti `penulis`.
  penulis: { nama: string } | null;
  penyunting: { nama: string } | null;
  disunting_at: string | null;
};

const SENTINEL_KOSONG = "00000000-0000-0000-0000-000000000000";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRekapCatatanHarianAkses();

  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const jenisFilter = getStr(sp.jenis);
  const kelasFilter = getStr(sp.kelas);
  const dateFrom = getStr(sp.from);
  const dateTo = getStr(sp.to);

  const supabase = await createClient();
  const hariIni = todayJakarta();

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
      "id, tanggal, jenis, isi, disunting_at, santri:santri(nama, nis), kelas:kelas(nama_kelas), penulis:pegawai!dicatat_oleh(nama), penyunting:pegawai!disunting_oleh(nama)",
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

  // Lebar tiap kolom ditetapkan lewat `headClassName` (yang mengatur <th>,
  // penentu lebar pada tabel ber-layout otomatis). Tanpa itu kolom Catatan
  // terhimpit oleh kolom lain sampai teksnya jatuh satu-dua kata per baris.
  const columns: Column<Row>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      headClassName: "w-28",
      className: "whitespace-nowrap align-top text-xs",
      cell: (r) => formatDateID(r.tanggal),
    },
    {
      key: "santri",
      header: "Santri",
      headClassName: "w-52",
      className: "align-top",
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{orDash(r.santri?.nama)}</p>
          {r.santri?.nis && (
            <p className="font-mono text-xs text-muted-foreground">{r.santri.nis}</p>
          )}
        </div>
      ),
    },
    {
      key: "kelas",
      header: "Kelas",
      headClassName: "w-32",
      className: "whitespace-nowrap align-top text-sm",
      cell: (r) => orDash(r.kelas?.nama_kelas),
    },
    {
      key: "jenis",
      header: "Jenis",
      headClassName: "w-36",
      className: "whitespace-nowrap align-top",
      cell: (r) => (
        <Badge variant={JENIS_VARIANT[r.jenis]}>{JENIS_LABEL[r.jenis]}</Badge>
      ),
    },
    {
      key: "isi",
      header: "Catatan",
      headClassName: "min-w-[26rem]",
      className: "align-top text-sm",
      // Dipotong 4 baris: catatan bisa sepanjang beberapa paragraf, dan satu
      // baris setinggi itu membuat seluruh tabel tidak terbaca. Teks utuhnya
      // muncul saat kursor diarahkan ke selnya.
      cell: (r) => (
        <p className="line-clamp-4 whitespace-pre-line leading-snug" title={r.isi}>
          {r.isi}
        </p>
      ),
    },
    {
      key: "penulis",
      header: "Ditulis oleh",
      headClassName: "w-48",
      className: "align-top text-sm",
      cell: (r) => <span className="leading-snug">{orDash(r.penulis?.nama)}</span>,
    },
    {
      key: "disunting",
      header: "Disunting",
      headClassName: "w-44",
      className: "align-top text-xs",
      cell: (r) =>
        r.disunting_at ? (
          <span className="leading-snug text-muted-foreground">
            {orDash(r.penyunting?.nama)}
            <br />
            {formatDateID(tanggalWib(r.disunting_at))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "w-24",
      className: "align-top",
      cell: (r) => (
        <div className="flex gap-1">
          <EditCatatanDialog
            id={r.id}
            santriNama={r.santri?.nama ?? "—"}
            tanggalAwal={r.tanggal}
            jenisAwal={r.jenis}
            isiAwal={r.isi}
            hariIni={hariIni}
          />
          <ConfirmDialog
            action={hapusCatatanAdmin}
            id={r.id}
            title="Hapus catatan ini?"
            description="Catatan akan hilang dari rekap dan dari portal wali. Tindakan ini tidak bisa dibatalkan."
            successMessage="Catatan dihapus."
            trigger={
              <Button type="button" variant="ghost" size="icon" aria-label="Hapus catatan">
                <Trash2 className="size-3.5 text-negative" />
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
