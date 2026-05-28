import { CalendarCheck, SquarePen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { InputPoinForm } from "./input-poin-form";
import type { PoinOpt } from "./schema";

export default async function Page() {
  const profile = await getProfile();
  const canOverride = profile?.perms.super ?? false;

  if (!profile?.perms.input_poin) {
    return (
      <div className="animate-enter mx-auto max-w-5xl p-6 md:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Anda tidak memiliki hak akses untuk input poin.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: poinData } = await supabase
    .from("master_poin")
    .select("id, kode_poin, nama_poin, tipe, nilai_poin, level")
    .eq("is_aktif", true)
    .order("kode_poin");
  const poinList = (poinData ?? []) as PoinOpt[];

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("tahun")
    .eq("is_aktif", true)
    .maybeSingle();

  return (
    <div className="animate-enter mx-auto max-w-5xl space-y-7 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-[#00b4d8] text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-white/15">
            <SquarePen className="size-5" />
          </span>
          <div className="space-y-0.5">
            <h1 className="font-heading text-xl font-bold tracking-tight">
              Input Poin
            </h1>
            <p className="text-sm text-muted-foreground">
              Catat poin positif &amp; negatif santri.
            </p>
          </div>
        </div>
        {ta?.tahun && (
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3.5 py-1.5 text-sm font-medium text-primary">
            <CalendarCheck className="size-4" />
            T.A. {ta.tahun}
          </span>
        )}
      </div>
      {!ta ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada tahun ajaran aktif. Aktifkan dulu di Master → Tahun Ajaran.
          </CardContent>
        </Card>
      ) : (
        <InputPoinForm
          poinList={poinList}
          canOverride={canOverride}
          scoped={profile.perms.scope_kelas}
        />
      )}
    </div>
  );
}
