import Link from "next/link";
import { MessageSquareHeart, PenLine } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireCatatanHarian } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { todayJakarta } from "@/lib/absensi-status";
import {
  JENIS_LABEL,
  JENIS_VARIANT,
  labelJarakHari,
  type JenisCatatan,
} from "@/lib/catatan-harian";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CatatanDialog, type CatatanItem } from "./catatan-dialog";

type Kelas = { id: string; nama_kelas: string };
type Santri = { id: string; nis: string | null; nama: string };
type CatatanRow = {
  id: string;
  santri_id: string;
  tanggal: string;
  jenis: JenisCatatan;
  isi: string;
  dicatat_oleh: string | null;
};

const PAGE_SIZE = 1000;

/** Ambil SEMUA baris lewat paginasi — PostgREST membatasi 1000 baris per
 *  permintaan secara diam-diam, tanpa error. Pola sama seperti halaman
 *  Absensi Santri dan Rekap Absensi Santri. */
async function ambilSemua<T>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data } = await run(from, from + PAGE_SIZE - 1);
    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireCatatanHarian();
  const sp = await searchParams;
  const supabase = await createClient();
  const hariIni = todayJakarta();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  if (!ta?.id || !profile.pegawai_id) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader icon={MessageSquareHeart} title="Catatan Harian" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {!ta?.id
              ? "Belum ada tahun ajaran aktif."
              : "Akun ini belum terhubung ke data pegawai."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: gkData } = await supabase
    .from("guru_kelas")
    .select("kelas:kelas!inner(id, nama_kelas, tahun_ajaran_id)")
    .eq("pegawai_id", profile.pegawai_id)
    .eq("kelas.tahun_ajaran_id", ta.id);

  const kelasOptions = ((gkData ?? []) as unknown as { kelas: Kelas | null }[])
    .map((r) => r.kelas)
    .filter((k): k is Kelas => Boolean(k))
    .sort((a, b) =>
      a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true }),
    );

  if (kelasOptions.length === 0) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader icon={MessageSquareHeart} title="Catatan Harian" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Anda belum ditugaskan ke kelas manapun tahun ajaran ini.
          </CardContent>
        </Card>
      </div>
    );
  }

  const kelasParam = getStr(sp.kelas);
  const kelasTerpilih =
    kelasOptions.find((k) => k.id === kelasParam) ?? kelasOptions[0];

  const [{ data: rosterData }, catatanRows] = await Promise.all([
    supabase
      .from("santri_kelas")
      .select("santri:santri(id, nis, nama)")
      .eq("kelas_id", kelasTerpilih.id),
    // Diambil lewat paginasi. Satu kelas aktif selama setahun ajaran bisa
    // menembus batas diam-diam 1000 baris PostgREST (mis. 40 santri x 2
    // catatan/bulan x 12 bulan), dan yang terpotong tidak menimbulkan error
    // apa pun — catatan lama sekadar lenyap dari dialog.
    //
    // Tanpa embed `pegawai`: peran sempit hanya boleh membaca baris pegawai
    // miliknya sendiri, jadi nama musyrif lain akan selalu null. Nama penulis
    // memang tidak ditampilkan di mana pun pada halaman ini.
    ambilSemua<CatatanRow>((from, to) =>
      supabase
        .from("catatan_harian")
        .select("id, santri_id, tanggal, jenis, isi, dicatat_oleh")
        .eq("kelas_id", kelasTerpilih.id)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  const roster = ((rosterData ?? []) as unknown as { santri: Santri | null }[])
    .map((r) => r.santri)
    .filter((s): s is Santri => Boolean(s))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const catatanBySantri = new Map<string, CatatanItem[]>();
  for (const c of catatanRows) {
    const list = catatanBySantri.get(c.santri_id) ?? [];
    list.push({
      id: c.id,
      tanggal: c.tanggal,
      jenis: c.jenis,
      isi: c.isi,
      milikSaya: c.dicatat_oleh === profile.pegawai_id,
    });
    catatanBySantri.set(c.santri_id, list);
  }

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={MessageSquareHeart}
        title="Catatan Harian"
        description="Kabar tentang santri yang akan dibaca wali. Ditulis seperlunya, tidak wajib setiap hari."
      />

      {kelasOptions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {kelasOptions.map((k) => (
            <Link
              key={k.id}
              href={`/catatan-harian?kelas=${k.id}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                k.id === kelasTerpilih.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent/60",
              )}
            >
              {k.nama_kelas}
            </Link>
          ))}
        </div>
      )}

      {roster.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada santri di kelas ini.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {roster.map((s) => {
            const daftar = catatanBySantri.get(s.id) ?? [];
            const terakhir = daftar[0];
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-card border border-border/70 bg-card px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.nama}</p>
                  {/* Penanda "terakhir dikabari" inilah yang membuat menu
                      terpisah tetap terpakai — tanpa itu musyrif harus membuka
                      satu per satu untuk tahu siapa yang sudah lama tidak
                      dikabari, dan halaman terpisah gampang terlupakan. */}
                  {terakhir ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant={JENIS_VARIANT[terakhir.jenis]}>
                        {JENIS_LABEL[terakhir.jenis]}
                      </Badge>
                      {labelJarakHari(terakhir.tanggal, hariIni)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Belum pernah dikabari
                    </p>
                  )}
                </div>
                <CatatanDialog
                  santriId={s.id}
                  santriNama={s.nama}
                  hariIni={hariIni}
                  catatan={daftar}
                  trigger={
                    <Button type="button" variant="outline" className="h-10 shrink-0">
                      <PenLine className="size-4" />
                      Tulis
                    </Button>
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
