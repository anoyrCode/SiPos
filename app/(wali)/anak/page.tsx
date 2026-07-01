import Link from "next/link";
import { ChevronRight, ShieldAlert, ShieldCheck, Sparkles, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { orDash } from "@/lib/format";
import { cn } from "@/lib/utils";

type SantriAnak = {
  id: string;
  nis: string | null;
  nama: string;
};

function initials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  const s =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : nama.trim().slice(0, 2);
  return (s || "?").toUpperCase();
}

export default async function Page() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun")
    .eq("is_aktif", true)
    .maybeSingle();

  const { data: ws } = await supabase
    .from("wali_santri")
    .select("santri:santri(id, nis, nama)")
    .eq("wali_id", profile?.wali_id ?? "");
  const anak = ((ws ?? []) as unknown as { santri: SantriAnak | null }[])
    .map((r) => r.santri)
    .filter((s): s is SantriAnak => Boolean(s));

  const ids = anak.map((s) => s.id);
  const skor = new Map<string, { pos: number; neg: number }>();
  const kelas = new Map<string, string>();

  if (ta?.id && ids.length > 0) {
    const [{ data: tr }, { data: sk }] = await Promise.all([
      supabase
        .from("transaksi_poin")
        .select("santri_id, tipe, nilai_poin")
        .in("santri_id", ids)
        .eq("tahun_ajaran_id", ta.id),
      supabase
        .from("santri_kelas")
        .select("santri_id, kelas:kelas!inner(nama_kelas, tahun_ajaran_id)")
        .in("santri_id", ids)
        .eq("kelas.tahun_ajaran_id", ta.id),
    ]);
    for (const t of (tr ?? []) as {
      santri_id: string;
      tipe: "POSITIF" | "NEGATIF";
      nilai_poin: number;
    }[]) {
      const e = skor.get(t.santri_id) ?? { pos: 0, neg: 0 };
      if (t.tipe === "POSITIF") e.pos += t.nilai_poin;
      else e.neg += t.nilai_poin;
      skor.set(t.santri_id, e);
    }
    for (const r of (sk ?? []) as unknown as {
      santri_id: string;
      kelas: { nama_kelas: string } | null;
    }[]) {
      if (r.kelas?.nama_kelas) kelas.set(r.santri_id, r.kelas.nama_kelas);
    }
  }

  const namaWali = profile?.name ?? "Wali Santri";

  return (
    <div className="animate-enter space-y-4 p-4 md:space-y-6 md:p-8">
      {/* Hero sapaan */}
      <section
        className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg shadow-primary/20 sm:rounded-3xl sm:p-6 md:p-8"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #00b4d8 0%, #0092b7 55%, #036985 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
            <Sparkles className="size-4" />
            Assalamu&apos;alaikum
          </p>
          <h1 className="font-heading text-xl font-bold capitalize tracking-tight sm:text-2xl">
            {namaWali}
          </h1>
          <p className="text-sm text-white/80">
            {anak.length} anak terpantau
            {ta?.tahun ? ` · Tahun ajaran ${ta.tahun}` : ""}
          </p>
        </div>
      </section>

      {anak.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Users className="size-5 text-muted-foreground/70" />
            </span>
            <p className="text-sm text-muted-foreground">
              Belum ada anak yang terhubung dengan akun ini. Hubungi admin
              pesantren.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {anak.map((s) => {
            const e = skor.get(s.id) ?? { pos: 0, neg: 0 };
            const net = e.pos - e.neg;
            const total = e.pos + e.neg;
            const posW = total > 0 ? (e.pos / total) * 100 : 0;
            const baik = net >= 0;
            return (
              <Link key={s.id} href={`/anak/${s.id}`} className="group">
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="space-y-4">
                    {/* Header anak */}
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-[#00b4d8] text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25">
                        {initials(s.nama)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading text-base font-semibold capitalize">
                          {s.nama}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {orDash(kelas.get(s.id))}
                          {s.nis ? ` · ${s.nis}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>

                    {/* Status */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        baik
                          ? "bg-positive-soft text-positive"
                          : "bg-negative-soft text-negative",
                      )}
                    >
                      {baik ? (
                        <ShieldCheck className="size-3.5" />
                      ) : (
                        <ShieldAlert className="size-3.5" />
                      )}
                      {baik ? "Terjaga baik" : "Perlu perhatian"}
                    </span>

                    {/* Skor + rincian */}
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Skor total</p>
                        <p
                          className={cn(
                            "font-heading text-3xl font-bold tabular-nums",
                            baik ? "text-positive" : "text-negative",
                          )}
                        >
                          {net > 0 ? "+" : ""}
                          {net}
                        </p>
                      </div>
                      <div className="space-y-1 text-right text-xs tabular-nums">
                        <p className="text-positive">+{e.pos} positif</p>
                        <p className="text-negative">−{e.neg} negatif</p>
                      </div>
                    </div>

                    {/* Bar keseimbangan */}
                    <div className="space-y-1">
                      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                        {total > 0 ? (
                          <>
                            <div
                              className="h-full bg-chart-pos"
                              style={{ width: `${posW}%` }}
                            />
                            <div
                              className="h-full bg-chart-neg"
                              style={{ width: `${100 - posW}%` }}
                            />
                          </>
                        ) : null}
                      </div>
                      {total === 0 && (
                        <p className="text-[0.7rem] text-muted-foreground">
                          Belum ada poin tahun ini.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
