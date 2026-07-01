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
import { Field } from "@/components/shared/field";
import { pegawaiSchema, type PegawaiInput, type PegawaiRow } from "./schema";
import { createPegawai, updatePegawai } from "./actions";

export function PegawaiForm({ initial }: { initial?: PegawaiRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: PegawaiInput = {
    nip: initial?.nip ?? "",
    nama: initial?.nama ?? "",
    email: initial?.email ?? "",
    jabatan: initial?.jabatan ?? "",
    jenis_kelamin: initial?.jenis_kelamin ?? undefined,
    telp: initial?.telp ?? "",
    tempat_lahir: initial?.tempat_lahir ?? "",
    tanggal_lahir: initial?.tanggal_lahir ?? "",
    alamat: initial?.alamat ?? "",
  };

  const form = useForm<PegawaiInput>({
    resolver: zodResolver(pegawaiSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updatePegawai(initial.id, values)
      : await createPegawai(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Data pegawai diperbarui." : "Pegawai berhasil ditambahkan.");
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
            Tambah Pegawai
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>{initial ? "Edit Pegawai" : "Tambah Pegawai"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Perbarui informasi data pegawai."
              : "Lengkapi data untuk menambahkan pegawai baru."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 max-h-[58vh] space-y-6 overflow-y-auto px-2 py-1 scrollbar-thin">
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Identitas & Kontak
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="NIP"
                  htmlFor="nip"
                  error={form.formState.errors.nip?.message}
                >
                  <Input id="nip" {...form.register("nip")} />
                </Field>
                <Field
                  label="Nama"
                  htmlFor="nama"
                  required
                  error={form.formState.errors.nama?.message}
                >
                  <Input id="nama" {...form.register("nama")} />
                </Field>
                <Field
                  label="Jabatan"
                  htmlFor="jabatan"
                  hint="mis. Guru, Wali Kelas, Pengasuh, TU"
                  error={form.formState.errors.jabatan?.message}
                >
                  <Input id="jabatan" {...form.register("jabatan")} />
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
                <Field
                  label="Email"
                  htmlFor="email"
                  error={form.formState.errors.email?.message}
                >
                  <Input id="email" type="email" {...form.register("email")} />
                </Field>
                <Field
                  label="Telepon"
                  htmlFor="telp"
                  error={form.formState.errors.telp?.message}
                >
                  <Input id="telp" {...form.register("telp")} />
                </Field>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kelahiran & Alamat
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Tempat Lahir"
                  htmlFor="tempat_lahir"
                  error={form.formState.errors.tempat_lahir?.message}
                >
                  <Input id="tempat_lahir" {...form.register("tempat_lahir")} />
                </Field>
                <Field
                  label="Tanggal Lahir"
                  htmlFor="tanggal_lahir"
                  error={form.formState.errors.tanggal_lahir?.message}
                >
                  <Input
                    id="tanggal_lahir"
                    type="date"
                    {...form.register("tanggal_lahir")}
                  />
                </Field>
                <Field
                  label="Alamat"
                  htmlFor="alamat"
                  className="sm:col-span-2"
                  error={form.formState.errors.alamat?.message}
                >
                  <Textarea id="alamat" {...form.register("alamat")} />
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
