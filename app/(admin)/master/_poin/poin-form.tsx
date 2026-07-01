"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/shared/field";
import {
  poinSchema,
  type PoinInput,
  type PoinRow,
  type PoinTipe,
} from "./schema";
import { createPoin, updatePoin } from "./actions";

export function PoinForm({
  tipe,
  initial,
  nextKode,
  levels = [],
}: {
  tipe: PoinTipe;
  initial?: PoinRow;
  nextKode?: string;
  levels?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Pastikan level lama (yang sudah dipakai poin ini) tetap muncul di pilihan.
  const levelOptions =
    initial?.level && !levels.includes(initial.level)
      ? [initial.level, ...levels]
      : levels;
  const label = tipe === "POSITIF" ? "Poin Positif" : "Poin Negatif";

  const defaults: PoinInput = {
    kode_poin: initial?.kode_poin ?? nextKode ?? "",
    nama_poin: initial?.nama_poin ?? "",
    deskripsi_poin: initial?.deskripsi_poin ?? "",
    nilai_poin: initial?.nilai_poin ?? 0,
    level: initial?.level ?? "",
    keterangan: initial?.keterangan ?? "",
    is_aktif: initial?.is_aktif ?? true,
  };

  const form = useForm<PoinInput>({
    resolver: zodResolver(poinSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updatePoin(tipe, initial.id, values)
      : await createPoin(tipe, values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Data poin diperbarui." : "Poin berhasil ditambahkan.");
    if (!initial) form.reset(defaults);
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setServerError(null);
          form.reset(defaults);
        }
      }}
    >
      <DialogTrigger asChild>
        {initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            Tambah {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>
            {initial ? `Edit ${label}` : `Tambah ${label}`}
          </DialogTitle>
          <DialogDescription>
            {initial
              ? `Perbarui informasi ${label.toLowerCase()}.`
              : `Lengkapi data untuk menambahkan ${label.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 max-h-[58vh] space-y-4 overflow-y-auto px-2 py-1 scrollbar-thin">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Kode Poin"
              htmlFor="kode_poin"
              required
              hint={initial ? undefined : "Dibuat otomatis."}
              error={form.formState.errors.kode_poin?.message}
            >
              <Input
                id="kode_poin"
                readOnly={!initial}
                placeholder={tipe === "POSITIF" ? "P-001" : "N-001"}
                className={!initial ? "bg-muted/50 font-mono text-muted-foreground" : undefined}
                {...form.register("kode_poin")}
              />
            </Field>
            <Field
              label="Nilai Poin"
              htmlFor="nilai_poin"
              required
              hint="Magnitudo (selalu positif)."
              error={form.formState.errors.nilai_poin?.message}
            >
              <Input
                id="nilai_poin"
                type="number"
                {...form.register("nilai_poin", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Field
            label="Nama Poin"
            htmlFor="nama_poin"
            required
            error={form.formState.errors.nama_poin?.message}
          >
            <Input id="nama_poin" {...form.register("nama_poin")} />
          </Field>
          <Field
            label="Level"
            hint={
              levelOptions.length === 0
                ? "Belum ada level. Tambah di Master → Level Poin."
                : undefined
            }
            error={form.formState.errors.level?.message}
          >
            <Controller
              control={form.control}
              name="level"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOptions.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Deskripsi"
            htmlFor="deskripsi_poin"
            error={form.formState.errors.deskripsi_poin?.message}
          >
            <Textarea id="deskripsi_poin" {...form.register("deskripsi_poin")} />
          </Field>
          <Field
            label="Keterangan"
            htmlFor="keterangan"
            error={form.formState.errors.keterangan?.message}
          >
            <Input id="keterangan" {...form.register("keterangan")} />
          </Field>
          <Controller
            control={form.control}
            name="is_aktif"
            render={({ field }) => (
              <label className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium">Aktif</span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          </div>
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <DialogFooter className="-mx-6 -mb-6 border-t bg-muted/20 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
