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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { kelasSchema, type KelasInput, type KelasRow, type Option } from "./schema";
import { createKelas, updateKelas } from "./actions";

const NONE = "__none";

export function KelasForm({
  initial,
  levels,
  tahunAjaran,
  pegawai,
}: {
  initial?: KelasRow;
  levels: Option[];
  tahunAjaran: Option[];
  pegawai: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: KelasInput = {
    nama_kelas: initial?.nama_kelas ?? "",
    level_pendidikan_id: initial?.level_pendidikan_id ?? "",
    tahun_ajaran_id: initial?.tahun_ajaran_id ?? "",
    wali_id: initial?.wali_id ?? "",
  };

  const form = useForm<KelasInput>({
    resolver: zodResolver(kelasSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updateKelas(initial.id, values)
      : await createKelas(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Data kelas diperbarui." : "Kelas berhasil ditambahkan.");
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
            Tambah Kelas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Kelas" : "Tambah Kelas"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Nama Kelas"
            htmlFor="nama_kelas"
            required
            hint="mis. 7A, XI IPA 1"
            error={form.formState.errors.nama_kelas?.message}
          >
            <Input id="nama_kelas" {...form.register("nama_kelas")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Level Pendidikan"
              required
              error={form.formState.errors.level_pendidikan_id?.message}
            >
              <Controller
                control={form.control}
                name="level_pendidikan_id"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih level" />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Tahun Ajaran"
              required
              error={form.formState.errors.tahun_ajaran_id?.message}
            >
              <Controller
                control={form.control}
                name="tahun_ajaran_id"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tahun ajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {tahunAjaran.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field
            label="Wali Kelas"
            hint="Opsional."
            error={form.formState.errors.wali_id?.message}
          >
            <Controller
              control={form.control}
              name="wali_id"
              render={({ field }) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih wali kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                    {pegawai.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
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
