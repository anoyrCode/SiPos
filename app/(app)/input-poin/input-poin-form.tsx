"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  NotebookPen,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/shared/field";
import { cn } from "@/lib/utils";
import { SantriMultiPicker } from "./santri-multi-picker";
import { PoinMultiPicker } from "./poin-multi-picker";
import {
  inputPoinSchema,
  type InputPoinValues,
  type PoinOpt,
  type SantriHit,
} from "./schema";
import { createTransaksi, getScopedSantri } from "./actions";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatTanggal(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* Judul section dengan ikon + nomor langkah */
function SectionHeader({
  step,
  title,
  icon: Icon,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
        {step}
      </span>
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h2>
    </div>
  );
}

export function InputPoinForm({
  poinList,
  canOverride,
  scoped = false,
}: {
  poinList: PoinOpt[];
  canOverride: boolean;
  scoped?: boolean;
}) {
  const router = useRouter();
  const [tipe, setTipe] = useState<"POSITIF" | "NEGATIF">("POSITIF");
  const [santri, setSantri] = useState<SantriHit[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  async function pilihSemuaKelas() {
    setLoadingAll(true);
    try {
      const all = await getScopedSantri();
      setSantri(all);
    } finally {
      setLoadingAll(false);
    }
  }

  const form = useForm<InputPoinValues>({
    resolver: zodResolver(inputPoinSchema),
    defaultValues: {
      santri_ids: [],
      master_poin_ids: [],
      nilai_poin: 0,
      is_override: false,
      tanggal_kejadian: today(),
      catatan: "",
    },
  });

  const poinForTipe = poinList.filter((p) => p.tipe === tipe);
  const selectedPoinIds =
    useWatch({ control: form.control, name: "master_poin_ids" }) ?? [];
  const selectedPoins = poinList.filter((p) => selectedPoinIds.includes(p.id));
  const single = selectedPoins.length === 1;
  const override = useWatch({ control: form.control, name: "is_override" });
  const nilaiWatch = useWatch({ control: form.control, name: "nilai_poin" });
  const tanggalWatch = useWatch({ control: form.control, name: "tanggal_kejadian" });

  // Nilai per santri: override hanya berlaku saat tepat 1 poin dipilih.
  const perSantriNilai =
    single && override
      ? nilaiWatch || 0
      : selectedPoins.reduce((s, p) => s + p.nilai_poin, 0);
  const totalTransaksi = santri.length * selectedPoins.length;

  // Sinkron picker → field santri_ids
  useEffect(() => {
    form.setValue(
      "santri_ids",
      santri.map((s) => s.id),
      { shouldValidate: santri.length > 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [santri]);

  // Saat 1 poin & tidak override, nilai terkunci ke master.
  useEffect(() => {
    if (single && !override) {
      form.setValue("nilai_poin", selectedPoins[0].nilai_poin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoinIds.join(","), override]);

  function changeTipe(t: "POSITIF" | "NEGATIF") {
    setTipe(t);
    form.setValue("master_poin_ids", [], { shouldValidate: false });
    form.setValue("nilai_poin", 0);
    form.setValue("is_override", false);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    const res = await createTransaksi(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setSuccess(`Tersimpan ${res.inserted} transaksi poin.`);
    setSantri([]);
    form.setValue("santri_ids", []);
    form.setValue("master_poin_ids", []);
    form.setValue("catatan", "");
    router.refresh();
  });

  const isPos = tipe === "POSITIF";

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3 lg:items-start">
      {/* ====== Kolom form ====== */}
      <Card className="lg:col-span-2">
        <CardContent className="space-y-7">
          {/* Section 1 */}
          <div className="space-y-5">
            <SectionHeader step={1} title="Sasaran & Jenis" icon={Users} />

            <Field
              label="Santri"
              required
              hint="Bisa pilih beberapa santri sekaligus (batch)."
              error={form.formState.errors.santri_ids?.message}
            >
              <SantriMultiPicker value={santri} onChange={setSantri} />
              {scoped && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={pilihSemuaKelas}
                  disabled={loadingAll}
                >
                  <Users data-icon="inline-start" />
                  {loadingAll ? "Memuat…" : "Pilih semua santri kelas saya"}
                </Button>
              )}
            </Field>

            <Field label="Jenis Poin">
              <div className="grid grid-cols-2 gap-2.5 sm:max-w-sm">
                <button
                  type="button"
                  onClick={() => changeTipe("POSITIF")}
                  aria-pressed={isPos}
                  className={cn(
                    "group flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all duration-200 ease-(--ease-smooth)",
                    isPos
                      ? "border-positive bg-positive-soft text-positive shadow-sm"
                      : "border-border text-muted-foreground hover:border-positive/40 hover:bg-positive-soft/40",
                  )}
                >
                  <ThumbsUp className="size-4" />
                  Positif
                </button>
                <button
                  type="button"
                  onClick={() => changeTipe("NEGATIF")}
                  aria-pressed={!isPos}
                  className={cn(
                    "group flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all duration-200 ease-(--ease-smooth)",
                    !isPos
                      ? "border-negative bg-negative-soft text-negative shadow-sm"
                      : "border-border text-muted-foreground hover:border-negative/40 hover:bg-negative-soft/40",
                  )}
                >
                  <ThumbsDown className="size-4" />
                  Negatif
                </button>
              </div>
            </Field>

            <Field
              label="Poin"
              required
              hint="Bisa pilih beberapa poin sekaligus."
              error={form.formState.errors.master_poin_ids?.message}
            >
              <Controller
                control={form.control}
                name="master_poin_ids"
                render={({ field }) => (
                  <PoinMultiPicker
                    options={poinForTipe}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    tipe={tipe}
                  />
                )}
              />
            </Field>
          </div>

          <div className="h-px bg-border" />

          {/* Section 2 */}
          <div className="space-y-5">
            <SectionHeader step={2} title="Detail Poin" icon={NotebookPen} />

            {single ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Nilai Poin"
                  hint={canOverride ? undefined : "Terkunci dari master."}
                  error={form.formState.errors.nilai_poin?.message}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      disabled={!(canOverride && override)}
                      {...form.register("nilai_poin", { valueAsNumber: true })}
                    />
                    <Badge variant={isPos ? "positive" : "negative"}>
                      {isPos ? "+" : "−"}
                      {nilaiWatch || 0}
                    </Badge>
                  </div>
                </Field>
                {canOverride && (
                  <Controller
                    control={form.control}
                    name="is_override"
                    render={({ field }) => (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-2 self-end rounded-xl border px-3 py-2.5 transition-colors",
                          field.value
                            ? "border-primary/40 bg-primary/5"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <span className="text-sm font-medium">Override nilai</span>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(c) => {
                            field.onChange(c);
                            if (!c && selectedPoins[0]) {
                              form.setValue("nilai_poin", selectedPoins[0].nilai_poin);
                            }
                          }}
                        />
                      </label>
                    )}
                  />
                )}
              </div>
            ) : selectedPoins.length > 1 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                {selectedPoins.length} poin dipilih — nilai mengikuti master
                tiap poin{canOverride ? " (override hanya untuk 1 poin)" : ""}.
              </p>
            ) : null}

            <Field
              label="Tanggal Kejadian"
              required
              className="sm:max-w-xs"
              error={form.formState.errors.tanggal_kejadian?.message}
            >
              <Input type="date" {...form.register("tanggal_kejadian")} />
            </Field>

            <Field label="Catatan" error={form.formState.errors.catatan?.message}>
              <Textarea placeholder="Opsional" {...form.register("catatan")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ====== Kolom ringkasan (sticky) ====== */}
      <div className="lg:sticky lg:top-6">
        <Card
          className={cn(
            "overflow-hidden border-t-4 transition-colors",
            isPos ? "border-t-positive" : "border-t-negative",
          )}
        >
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="font-heading text-sm font-semibold">Ringkasan</h2>
            </div>

            {/* Nilai besar */}
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nilai per santri
              </p>
              <p
                className={cn(
                  "font-heading text-4xl font-bold tabular-nums",
                  selectedPoins.length
                    ? isPos
                      ? "text-positive"
                      : "text-negative"
                    : "text-muted-foreground/40",
                )}
              >
                {selectedPoins.length
                  ? `${isPos ? "+" : "−"}${perSantriNilai}`
                  : "—"}
              </p>
            </div>

            {/* Baris ringkasan */}
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Santri</dt>
                <dd className="font-medium tabular-nums">
                  {santri.length > 0 ? `${santri.length} dipilih` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Jenis</dt>
                <dd>
                  <Badge variant={isPos ? "positive" : "negative"}>
                    {isPos ? "Positif" : "Negatif"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Poin</dt>
                <dd className="text-right font-medium">
                  {selectedPoins.length === 0
                    ? "—"
                    : selectedPoins.length === 1
                      ? selectedPoins[0].nama_poin
                      : `${selectedPoins.length} poin`}
                </dd>
              </div>
              {totalTransaksi > 0 && (
                <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                  <dt className="text-muted-foreground">Total transaksi</dt>
                  <dd className="font-semibold tabular-nums">{totalTransaksi}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Tanggal
                </dt>
                <dd className="font-medium">{formatTanggal(tanggalWatch)}</dd>
              </div>
            </dl>

            {serverError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}
            {success && (
              <p className="flex items-center gap-1.5 rounded-lg bg-positive-soft px-3 py-2 text-sm font-medium text-positive">
                <Check className="size-4" />
                {success}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Menyimpan…"
                : totalTransaksi > 1
                  ? `Simpan ${totalTransaksi} transaksi`
                  : "Simpan Poin"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
