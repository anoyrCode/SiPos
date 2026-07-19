import { MailWarning } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  SuratPanggilanTable,
  type SuratPanggilanRow,
} from "./surat-panggilan-table";

type NegatifTx = {
  santri_id: string;
  nilai_poin: number;
  tanggal_kejadian: string;
  catatan: string | null;
  master_poin: { nama_poin: string; kode_poin: string } | null;
};

const TX_PAGE_SIZE = 1000;

/**
 * Ambil SEMUA transaksi NEGATIF 1 tahun ajaran, dipaginasi penuh —
 * Supabase/PostgREST membatasi 1000 baris per request secara default,
 * jadi tahun ajaran dgn >1000 transaksi negatif bakal diam-diam
 * terpotong tanpa ini (bisa bikin santri yg sebenarnya sudah kena
 * ambang SP tidak muncul di daftar).
 */
async function fetchAllNegatif(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taId: string,
): Promise<NegatifTx[]> {
  const rows: NegatifTx[] = [];
  let from = 0;
  for (;;) {
    const { data } = await supabase
      .from("transaksi_poin")
      .select(
        "santri_id, nilai_poin, tanggal_kejadian, catatan, master_poin:master_poin(nama_poin, kode_poin)",
      )
      .eq("tahun_ajaran_id", taId)
      .eq("tipe", "NEGATIF")
      .range(from, from + TX_PAGE_SIZE - 1);
    const page = (data ?? []) as unknown as NegatifTx[];
    rows.push(...page);
    if (page.length < TX_PAGE_SIZE) break;
    from += TX_PAGE_SIZE;
  }
  return rows;
}

export default async function Page() {
  const profile = await getProfile();
  if (!profile?.perms.laporan) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Anda tidak memiliki hak akses untuk melihat halaman ini.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun")
    .eq("is_aktif", true)
    .maybeSingle();
  const taLabel = ta?.tahun ?? "—";

  let rows: SuratPanggilanRow[] = [];

  if (ta?.id) {
    const [tx, skRes] = await Promise.all([
      fetchAllNegatif(supabase, ta.id),
      supabase
        .from("santri_kelas")
        .select("santri_id, kelas:kelas!inner(nama_kelas, tahun_ajaran_id)")
        .eq("kelas.tahun_ajaran_id", ta.id),
    ]);

    const santriKelas = new Map<string, string>();
    for (const row of (skRes.data ?? []) as unknown as {
      santri_id: string;
      kelas: { nama_kelas: string } | null;
    }[]) {
      if (row.kelas?.nama_kelas) santriKelas.set(row.santri_id, row.kelas.nama_kelas);
    }

    const agg = new Map<
      string,
      { total: number; pelanggaran: SuratPanggilanRow["pelanggaran"] }
    >();
    for (const t of tx) {
      const e = agg.get(t.santri_id) ?? { total: 0, pelanggaran: [] };
      e.total += t.nilai_poin;
      e.pelanggaran.push({
        tanggal: t.tanggal_kejadian,
        namaPoin: t.master_poin?.nama_poin ?? "—",
        kodePoin: t.master_poin?.kode_poin ?? "—",
        nilai: t.nilai_poin,
        catatan: t.catatan,
      });
      agg.set(t.santri_id, e);
    }

    const ids = [...agg.keys()];
    if (ids.length > 0) {
      const { data: santriData } = await supabase
        .from("santri")
        .select("id, nis, nama, nama_wali, no_telp_wali")
        .in("id", ids);
      const santriMap = new Map((santriData ?? []).map((s) => [s.id, s]));

      rows = ids
        .map((id) => {
          const s = santriMap.get(id);
          const e = agg.get(id)!;
          return {
            id,
            nama: s?.nama ?? "?",
            nis: s?.nis ?? null,
            kelas: santriKelas.get(id) ?? null,
            namaWali: s?.nama_wali ?? null,
            noTelpWali: s?.no_telp_wali ?? null,
            totalNegatif: e.total,
            pelanggaran: e.pelanggaran.sort((a, b) =>
              a.tanggal < b.tanggal ? 1 : -1,
            ),
          };
        })
        .sort((a, b) => b.totalNegatif - a.totalNegatif);
    }
  }

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={MailWarning}
        title="Surat Panggilan"
        description="Cetak surat panggilan orang tua/wali untuk santri dengan akumulasi poin negatif melewati ambang batas."
      />
      <SuratPanggilanTable rows={rows} taLabel={taLabel} />
    </div>
  );
}
