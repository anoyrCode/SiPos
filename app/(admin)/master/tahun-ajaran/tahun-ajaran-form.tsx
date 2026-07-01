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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/shared/field";
import { tahunAjaranSchema, type TahunAjaranInput } from "./schema";
import { createTahunAjaran, updateTahunAjaran } from "./actions";

export type TahunAjaranRow = {
  id: string;
  tahun: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  is_aktif: boolean;
};

export function TahunAjaranForm({ initial }: { initial?: TahunAjaranRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: TahunAjaranInput = {
    tahun: initial?.tahun ?? "",
    tanggal_mulai: initial?.tanggal_mulai ?? "",
    tanggal_selesai: initial?.tanggal_selesai ?? "",
    is_aktif: initial?.is_aktif ?? false,
  };

  const form = useForm<TahunAjaranInput>({
    resolver: zodResolver(tahunAjaranSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updateTahunAjaran(initial.id, values)
      : await createTahunAjaran(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Tahun ajaran diperbarui." : "Tahun ajaran berhasil ditambahkan.");
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
            Tambah Tahun Ajaran
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Tahun Ajaran" : "Tambah Tahun Ajaran"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Tahun Ajaran"
            htmlFor="tahun"
            required
            hint="Format: 2026/2027"
            error={form.formState.errors.tahun?.message}
          >
            <Input id="tahun" placeholder="2026/2027" {...form.register("tahun")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Tanggal Mulai"
              htmlFor="tanggal_mulai"
              error={form.formState.errors.tanggal_mulai?.message}
            >
              <Input
                id="tanggal_mulai"
                type="date"
                {...form.register("tanggal_mulai")}
              />
            </Field>
            <Field
              label="Tanggal Selesai"
              htmlFor="tanggal_selesai"
              error={form.formState.errors.tanggal_selesai?.message}
            >
              <Input
                id="tanggal_selesai"
                type="date"
                {...form.register("tanggal_selesai")}
              />
            </Field>
          </div>
          <Controller
            control={form.control}
            name="is_aktif"
            render={({ field }) => (
              <label className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium">Jadikan tahun ajaran aktif</span>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </label>
            )}
          />
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
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
