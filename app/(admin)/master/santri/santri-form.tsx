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
import { Field } from "@/components/shared/field";
import { santriSchema, type SantriInput, type SantriRow } from "./schema";
import { createSantri, updateSantri } from "./actions";

export function SantriForm({ initial }: { initial?: SantriRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: SantriInput = {
    nis: initial?.nis ?? "",
    nisn: initial?.nisn ?? "",
    nama: initial?.nama ?? "",
    email: initial?.email ?? "",
    jenis_kelamin: initial?.jenis_kelamin ?? undefined,
    nama_ayah: initial?.nama_ayah ?? "",
    nama_ibu: initial?.nama_ibu ?? "",
    nama_wali: initial?.nama_wali ?? "",
    no_telp_wali: initial?.no_telp_wali ?? "",
    status: initial?.status ?? "aktif",
  };

  const form = useForm<SantriInput>({
    resolver: zodResolver(santriSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updateSantri(initial.id, values)
      : await createSantri(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Data santri diperbarui." : "Santri berhasil ditambahkan.");
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
            Tambah Santri
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>{initial ? "Edit Santri" : "Tambah Santri"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Perbarui informasi data santri."
              : "Lengkapi data untuk menambahkan santri baru."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 max-h-[58vh] space-y-6 overflow-y-auto px-2 py-1 scrollbar-thin">
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Identitas
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="NIS"
                  htmlFor="nis"
                  error={form.formState.errors.nis?.message}
                >
                  <Input id="nis" {...form.register("nis")} />
                </Field>
                <Field
                  label="NISN"
                  htmlFor="nisn"
                  error={form.formState.errors.nisn?.message}
                >
                  <Input id="nisn" {...form.register("nisn")} />
                </Field>
                <Field
                  label="Nama"
                  htmlFor="nama"
                  required
                  className="sm:col-span-2"
                  error={form.formState.errors.nama?.message}
                >
                  <Input id="nama" {...form.register("nama")} />
                </Field>
                <Field
                  label="Jenis Kelamin"
                  error={form.formState.errors.jenis_kelamin?.message}
                >
                  <Controller
                    control={form.control}
                    name="jenis_kelamin"
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">Laki-laki</SelectItem>
                          <SelectItem value="P">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Status" error={form.formState.errors.status?.message}>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aktif">Aktif</SelectItem>
                          <SelectItem value="lulus">Lulus</SelectItem>
                          <SelectItem value="keluar">Keluar</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field
                  label="Email"
                  htmlFor="email"
                  className="sm:col-span-2"
                  error={form.formState.errors.email?.message}
                >
                  <Input id="email" type="email" {...form.register("email")} />
                </Field>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Orang Tua / Wali
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Nama Ayah"
                  htmlFor="nama_ayah"
                  error={form.formState.errors.nama_ayah?.message}
                >
                  <Input id="nama_ayah" {...form.register("nama_ayah")} />
                </Field>
                <Field
                  label="Nama Ibu"
                  htmlFor="nama_ibu"
                  error={form.formState.errors.nama_ibu?.message}
                >
                  <Input id="nama_ibu" {...form.register("nama_ibu")} />
                </Field>
                <Field
                  label="Nama Wali"
                  htmlFor="nama_wali"
                  error={form.formState.errors.nama_wali?.message}
                >
                  <Input id="nama_wali" {...form.register("nama_wali")} />
                </Field>
                <Field
                  label="No WA/Telp Wali"
                  htmlFor="no_telp_wali"
                  hint="Dipakai sebagai username akun wali."
                  error={form.formState.errors.no_telp_wali?.message}
                >
                  <Input id="no_telp_wali" {...form.register("no_telp_wali")} />
                </Field>
              </div>
            </section>
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
