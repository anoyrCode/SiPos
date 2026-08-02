"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/shared/field";
import { levelPoinSchema, type LevelPoinInput, type LevelPoinRow } from "./schema";
import { createLevelPoin, updateLevelPoin } from "./actions";

export function LevelPoinForm({
  initial,
  defaultTipe,
}: {
  initial?: LevelPoinRow;
  defaultTipe?: "POSITIF" | "NEGATIF";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: LevelPoinInput = {
    tipe: initial?.tipe ?? defaultTipe ?? "POSITIF",
    nama: initial?.nama ?? "",
    urutan: initial?.urutan ?? 0,
    hitung_sp: initial?.hitung_sp ?? false,
  };

  const form = useForm<LevelPoinInput>({
    resolver: zodResolver(levelPoinSchema),
    defaultValues: defaults,
  });

  const tipe = useWatch({ control: form.control, name: "tipe" });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updateLevelPoin(initial.id, values)
      : await createLevelPoin(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Level poin diperbarui." : "Level poin berhasil ditambahkan.");
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
            Tambah Level
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>
            {initial ? "Edit Level Poin" : "Tambah Level Poin"}
          </DialogTitle>
          <DialogDescription>
            {initial
              ? "Perbarui level penilaian poin."
              : "Buat level custom untuk poin positif atau negatif."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 space-y-4 px-2 py-1">
            <Field label="Tipe" error={form.formState.errors.tipe?.message}>
              <Controller
                control={form.control}
                name="tipe"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POSITIF">Poin Positif</SelectItem>
                      <SelectItem value="NEGATIF">Poin Negatif</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Nama Level"
              htmlFor="nama"
              required
              hint="mis. PERUNGGU, PLATINUM, RINGAN…"
              error={form.formState.errors.nama?.message}
            >
              <Input id="nama" {...form.register("nama")} />
            </Field>
            <Field
              label="Urutan"
              htmlFor="urutan"
              hint="Untuk pengurutan tampilan."
              error={form.formState.errors.urutan?.message}
            >
              <Input
                id="urutan"
                type="number"
                {...form.register("urutan", { valueAsNumber: true })}
              />
            </Field>
            {tipe === "NEGATIF" && (
              <Controller
                control={form.control}
                name="hitung_sp"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">
                        Hitung untuk Surat Peringatan
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Hanya pelanggaran berlevel ini yang menambah ambang SP.
                        Level yang tidak dicentang tetap tercatat di riwayat dan
                        tetap mempengaruhi skor santri.
                      </span>
                    </span>
                  </label>
                )}
              />
            )}
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
