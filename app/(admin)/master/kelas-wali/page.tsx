import Link from "next/link";
import { LogOut, Network, Plus, School, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  getStr,
  paginateArray,
  parsePageParamsNamed,
  type SearchParams,
} from "@/lib/list-params";
import { orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DistribusiSelectors } from "./selectors";
import { WaliKelasSelect } from "./wali-select";
import { AddSantri } from "./add-santri";
import { removeSantriFromKelas } from "./actions";

type Anggota = {
  id: string;
  santri: {
    id: string;
    nis: string | null;
    nama: string;
    status: "aktif" | "lulus" | "keluar";
  } | null;
};

type KelasDetail = {
  id: string;
  nama_kelas: string;
  wali_id: string | null;
  jenis_kelamin: "L" | "P" | null;
  wali: { nama: string } | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: taData } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun, is_aktif")
    .order("tahun", { ascending: false });
  const taList = taData ?? [];
  const activeTa = taList.find((t) => t.is_aktif);
  const taId = getStr(sp.ta) || activeTa?.id || taList[0]?.id || "";

  const jkFilter = getStr(sp.jk);
  let kelasQuery = taId
    ? supabase
        .from("kelas")
        .select("id, nama_kelas, jenis_kelamin, level:level_pendidikan(nama)")
        .eq("tahun_ajaran_id", taId)
        .order("nama_kelas")
    : null;
  if (kelasQuery) {
    if (jkFilter === "kosong") kelasQuery = kelasQuery.is("jenis_kelamin", null);
    else if (jkFilter === "L" || jkFilter === "P")
      kelasQuery = kelasQuery.eq("jenis_kelamin", jkFilter);
  }
  const { data: kelasData } = kelasQuery ? await kelasQuery : { data: [] };
  const kelasList = (kelasData ?? []) as unknown as {
    id: string;
    nama_kelas: string;
    jenis_kelamin: "L" | "P" | null;
    level: { nama: string } | null;
  }[];

  const kelasId = getStr(sp.kelas);
  const selectedKelas = kelasList.find((k) => k.id === kelasId) ?? null;
  const { page, perPage } = parsePageParamsNamed(sp, "page", "perPage");

  const taOptions = taList.map((t) => ({
    value: t.id,
    label: t.is_aktif ? `${t.tahun} (aktif)` : t.tahun,
  }));
  const kelasOptions = kelasList.map((k) => ({
    value: k.id,
    label: k.level?.nama ? `${k.nama_kelas} · ${k.level.nama}` : k.nama_kelas,
  }));

  let kelasDetail: KelasDetail | null = null;
  let pegawaiOptions: { value: string; label: string }[] = [];
  let anggota: Anggota[] = [];
  let available: { id: string; nis: string | null; nama: string }[] = [];

  if (selectedKelas) {
    const [kdRes, pegRes, angRes, placedRes, activeRes] = await Promise.all([
      supabase
        .from("kelas")
        .select("id, nama_kelas, wali_id, jenis_kelamin, wali:pegawai(nama)")
        .eq("id", selectedKelas.id)
        .single(),
      supabase.from("pegawai").select("id, nama").order("nama"),
      supabase
        .from("santri_kelas")
        .select("id, santri:santri(id, nis, nama, status)")
        .eq("kelas_id", selectedKelas.id),
      supabase
        .from("santri_kelas")
        .select("santri_id, kelas!inner(tahun_ajaran_id)")
        .eq("kelas.tahun_ajaran_id", taId),
      supabase
        .from("santri")
        .select("id, nis, nama, jenis_kelamin")
        .eq("status", "aktif")
        .order("nama"),
    ]);

    kelasDetail = kdRes.data as unknown as KelasDetail;
    pegawaiOptions = (pegRes.data ?? []).map((p) => ({
      value: p.id,
      label: p.nama,
    }));
    anggota = ((angRes.data ?? []) as unknown as Anggota[])
      .slice()
      .sort((a, b) => (a.santri?.nama ?? "").localeCompare(b.santri?.nama ?? ""));
    const placedIds = new Set(
      ((placedRes.data ?? []) as unknown as { santri_id: string }[]).map(
        (p) => p.santri_id,
      ),
    );
    // Kelas bergender hanya menampilkan santri dengan gender sama. Santri
    // yang gendernya kosong sengaja tidak ditampilkan supaya tidak salah
    // masuk tanpa sengaja — server tetap mengizinkan kalau memang dikirim.
    const kelasJk = selectedKelas.jenis_kelamin;
    available = (activeRes.data ?? [])
      .filter((s) => !placedIds.has(s.id))
      .filter((s) => (kelasJk ? s.jenis_kelamin === kelasJk : true))
      .map((s) => ({ id: s.id, nis: s.nis, nama: s.nama }));
  }

  const pagedAnggota = paginateArray(anggota, page, perPage);

  const columns: Column<Anggota>[] = [
    {
      key: "nama",
      header: "Nama",
      cell: (r) => <span className="font-medium">{r.santri?.nama ?? "—"}</span>,
    },
    {
      key: "nis",
      header: "NIS",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {orDash(r.santri?.nis)}
        </span>
      ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <ConfirmDialog
          action={removeSantriFromKelas}
          id={r.id}
          title="Keluarkan santri dari kelas?"
          description={`"${r.santri?.nama ?? "Santri"}" akan dikeluarkan dari kelas ini.`}
          confirmLabel="Keluarkan"
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Keluarkan">
              <LogOut />
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={Network}
        title="Distribusi Kelas & Wali"
        description="Atur wali kelas dan penempatan santri per tahun ajaran."
      />

      {taList.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada tahun ajaran. Buat dulu di Master → Tahun Ajaran.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 sm:max-w-xs">
            <FilterSelect
              param="jk"
              placeholder="Jenis kelamin"
              allLabel="Semua jenis kelamin"
              options={[
                { value: "L", label: "Putra" },
                { value: "P", label: "Putri" },
                { value: "kosong", label: "Belum diisi" },
              ]}
            />
          </div>

          <DistribusiSelectors
            tahunAjaran={taOptions}
            kelas={kelasOptions}
            taId={taId}
            kelasId={kelasId}
          />

          {kelasList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <School className="size-5 text-muted-foreground/70" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Belum ada kelas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Belum ada kelas di tahun ajaran ini.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/master/kelas">
                    <Plus data-icon="inline-start" />
                    Tambah kelas
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : !selectedKelas ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Pilih kelas untuk mengatur wali & santri.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Wali Kelas</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    {kelasDetail?.nama_kelas}
                    {kelasDetail?.jenis_kelamin && (
                      <Badge
                        variant={kelasDetail.jenis_kelamin === "L" ? "primary" : "warning"}
                      >
                        {kelasDetail.jenis_kelamin === "L" ? "Putra" : "Putri"}
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <WaliKelasSelect
                    kelasId={selectedKelas.id}
                    waliId={kelasDetail?.wali_id ?? null}
                    pegawai={pegawaiOptions}
                  />
                  <p className="text-sm text-muted-foreground">
                    Saat ini: {orDash(kelasDetail?.wali?.nama)}
                  </p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      Anggota Kelas
                      <Badge variant="outline">{anggota.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {available.length > 0
                        ? `${available.length} santri aktif belum punya kelas — bisa ditambahkan.`
                        : selectedKelas.jenis_kelamin
                          ? `Semua santri ${selectedKelas.jenis_kelamin === "L" ? "Putra" : "Putri"} yang aktif sudah punya kelas.`
                          : "Semua santri aktif sudah punya kelas."}
                    </CardDescription>
                  </div>
                  <AddSantri
                    kelasId={selectedKelas.id}
                    available={available}
                    kelasJk={kelasDetail?.jenis_kelamin ?? null}
                    kelasNama={kelasDetail?.nama_kelas ?? ""}
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <DataTable
                    columns={columns}
                    rows={pagedAnggota.rows}
                    getRowId={(r) => r.id}
                    empty="Belum ada santri di kelas ini."
                  />
                  <Pagination
                    page={pagedAnggota.page}
                    perPage={perPage}
                    totalPages={pagedAnggota.totalPages}
                    totalItems={pagedAnggota.totalItems}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
