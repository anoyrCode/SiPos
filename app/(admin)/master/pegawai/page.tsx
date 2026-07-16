import { Trash2, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePegawai } from "@/lib/auth/dal";
import {
  getStr,
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
import { JabatanDialog } from "./jabatan-dialog";
import { deletePegawai } from "./actions";
import { JenisKelaminFilter } from "./jenis-kelamin-filter";
import { JabatanFilter } from "./jabatan-filter";
import {
  buildJadwalHarianSlots,
  type JabatanRow,
  type JadwalSementaraRow,
  type PegawaiRow,
} from "./schema";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePegawai();
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const jkFilter = getStr(sp.jk);
  const jabatanFilter = getStr(sp.jabatan).trim();

  const supabase = await createClient();
  let query = supabase
    .from("pegawai")
    .select(
      "id, nip, nama, email, jabatan, jabatan_tambahan, jenis_kelamin, telp, tempat_lahir, tanggal_lahir, alamat, jam_masuk_jadwal, jam_pulang_jadwal, hari_libur, jadwal_fleksibel, jadwal_harian_berbeda, shift_ganda, jam_masuk_jadwal_2, jam_pulang_jadwal_2, tanggal_mulai_absensi",
      { count: "exact" },
    )
    .order("nama", { ascending: true });
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.or(`nama.ilike.*${term}*,nip.ilike.*${term}*`);
  }
  if (jkFilter === "L" || jkFilter === "P") {
    query = query.eq("jenis_kelamin", jkFilter);
  }
  if (jabatanFilter) {
    const term = jabatanFilter.replace(/[,()*{}]/g, " ").trim();
    if (term) query = query.or(`jabatan.eq.${term},jabatan_tambahan.cs.{${term}}`);
  }
  const [
    { data, count },
    { data: pegawaiJabatanRows },
    { data: jadwalHarianRows },
    { data: jadwalSementaraRows },
    { data: jabatanMasterRows },
  ] = await Promise.all([
    query.range(from, to),
    supabase.from("pegawai").select("jabatan, jabatan_tambahan"),
    supabase
      .from("pegawai_jadwal_harian")
      .select("pegawai_id, hari, jam_masuk, jam_pulang"),
    supabase
      .from("pegawai_jadwal_sementara")
      .select("id, pegawai_id, tanggal_mulai, tanggal_selesai, jam_masuk, jam_pulang, keterangan"),
    supabase.from("jabatan").select("id, nama, is_aktif, is_guru").order("nama"),
  ]);
  type JadwalHarianRow = {
    pegawai_id: string;
    hari: number;
    jam_masuk: string | null;
    jam_pulang: string | null;
  };
  const jadwalHarianByPegawai = new Map<string, JadwalHarianRow[]>();
  for (const r of jadwalHarianRows ?? []) {
    const list = jadwalHarianByPegawai.get(r.pegawai_id) ?? [];
    list.push(r);
    jadwalHarianByPegawai.set(r.pegawai_id, list);
  }
  const jadwalSementaraByPegawai = new Map<string, JadwalSementaraRow[]>();
  for (const r of jadwalSementaraRows ?? []) {
    const list = jadwalSementaraByPegawai.get(r.pegawai_id) ?? [];
    list.push({
      id: r.id,
      tanggal_mulai: r.tanggal_mulai,
      tanggal_selesai: r.tanggal_selesai,
      jam_masuk: r.jam_masuk,
      jam_pulang: r.jam_pulang,
      keterangan: r.keterangan,
    });
    jadwalSementaraByPegawai.set(r.pegawai_id, list);
  }
  const rows = (data ?? []).map((p) => ({
    ...p,
    jadwal_harian: buildJadwalHarianSlots(
      jadwalHarianByPegawai.get(p.id) ?? [],
    ),
    jadwal_sementara: jadwalSementaraByPegawai.get(p.id) ?? [],
  })) as PegawaiRow[];

  const jabatanOptions = Array.from(
    new Set(
      (pegawaiJabatanRows ?? []).flatMap((r) =>
        [r.jabatan, ...(r.jabatan_tambahan ?? [])].filter(
          (j): j is string => !!j,
        ),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const jabatanRows: JabatanRow[] = jabatanMasterRows ?? [];
  const jabatanPresetAktif = jabatanRows
    .filter((j) => j.is_aktif)
    .map((j) => j.nama)
    .sort((a, b) => a.localeCompare(b));

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
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <span>{orDash(r.jabatan)}</span>
          {r.jabatan_tambahan?.map((j) => (
            <Badge key={j} variant="outline" className="text-[0.65rem]">
              {j}
            </Badge>
          ))}
        </div>
      ),
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
          <PegawaiForm initial={r} jabatanPreset={jabatanPresetAktif} />
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
        <JenisKelaminFilter value={jkFilter} />
        <JabatanFilter value={jabatanFilter} options={jabatanOptions} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <JabatanDialog rows={jabatanRows} />
          <PegawaiForm jabatanPreset={jabatanPresetAktif} />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q || !!jkFilter || !!jabatanFilter}
        empty="Belum ada data pegawai."
        emptyHint="Tambah pegawai dengan tombol di atas."
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
