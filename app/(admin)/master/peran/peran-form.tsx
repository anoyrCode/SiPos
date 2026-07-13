"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/shared/field";
import { peranSchema, type PeranInput, type PeranRow } from "./schema";
import { createPeran, updatePeran } from "./actions";

type PermKey =
  | "perm_input_poin"
  | "perm_laporan"
  | "perm_master"
  | "perm_akun"
  | "perm_kesehatan"
  | "perm_santri"
  | "perm_pegawai"
  | "perm_akun_staff"
  | "perm_akun_wali"
  | "perm_absensi"
  | "perm_dashboard"
  | "perm_approve_absensi"
  | "perm_rekap_absensi";

const PERMS: { key: PermKey; label: string; desc: string }[] = [
  { key: "perm_input_poin", label: "Input poin", desc: "Mencatat poin santri." },
  {
    key: "perm_laporan",
    label: "Lihat riwayat & laporan",
    desc: "Membuka Riwayat Poin & Laporan.",
  },
  {
    key: "perm_master",
    label: "Kelola master data",
    desc: "Tambah/edit santri, pegawai, poin, kelas, dll.",
  },
  {
    key: "perm_santri",
    label: "— Kelola data Santri saja",
    desc: "Tambah/edit/hapus data Santri, tanpa akses master data lain.",
  },
  {
    key: "perm_pegawai",
    label: "— Kelola data Pegawai saja",
    desc: "Tambah/edit/hapus data Pegawai, tanpa akses master data lain.",
  },
  {
    key: "perm_dashboard",
    label: "— Lihat Dashboard saja",
    desc: "Buka halaman Dashboard, tanpa akses kelola master data lain.",
  },
  {
    key: "perm_akun",
    label: "Kelola akun & peran",
    desc: "Buat akun staff dan atur hak aksesnya.",
  },
  {
    key: "perm_akun_staff",
    label: "— Kelola Akun Staff saja",
    desc: "Buat/atur Akun Staff saja, tanpa akses Akun Wali & Peran.",
  },
  {
    key: "perm_akun_wali",
    label: "— Kelola Akun Wali saja",
    desc: "Buat/atur Akun Wali saja, tanpa akses Akun Staff & Peran.",
  },
  {
    key: "perm_absensi",
    label: "Absensi (clock in/out)",
    desc: "Bisa clock in/out kehadiran sendiri berbasis lokasi pondok.",
  },
  {
    key: "perm_approve_absensi",
    label: "— Approve Izin/Sakit Absensi",
    desc: "Menyetujui/menolak pengajuan izin/sakit pegawai lain, tanpa akses master data lain.",
  },
  {
    key: "perm_rekap_absensi",
    label: "— Lihat Rekap Kehadiran (Semua Pegawai)",
    desc: "Buka rekap kehadiran per tanggal/bulan (termasuk laporan keterlambatan), tanpa akses master data lain & tanpa bisa approve izin.",
  },
  {
    key: "perm_kesehatan",
    label: "Kelola rekam medis (UKS)",
    desc: "Mencatat & melihat rekam medis santri di UKS.",
  },
];

export function PeranForm({ initial }: { initial?: PeranRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const isSuper = initial?.is_super ?? false;

  const defaults: PeranInput = {
    nama: initial?.nama ?? "",
    deskripsi: initial?.deskripsi ?? "",
    perm_input_poin: initial?.perm_input_poin ?? false,
    perm_laporan: initial?.perm_laporan ?? false,
    perm_master: initial?.perm_master ?? false,
    perm_akun: initial?.perm_akun ?? false,
    perm_kesehatan: initial?.perm_kesehatan ?? false,
    scope_kelas: initial?.scope_kelas ?? false,
    perm_santri: initial?.perm_santri ?? false,
    perm_pegawai: initial?.perm_pegawai ?? false,
    perm_akun_staff: initial?.perm_akun_staff ?? false,
    perm_akun_wali: initial?.perm_akun_wali ?? false,
    perm_absensi: initial?.perm_absensi ?? false,
    perm_dashboard: initial?.perm_dashboard ?? false,
    perm_approve_absensi: initial?.perm_approve_absensi ?? false,
    perm_rekap_absensi: initial?.perm_rekap_absensi ?? false,
  };

  const form = useForm<PeranInput>({
    resolver: zodResolver(peranSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updatePeran(initial.id, values)
      : await createPeran(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success(initial ? "Peran diperbarui." : "Peran berhasil ditambahkan.");
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
            Tambah Peran
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>{initial ? "Edit Peran" : "Tambah Peran"}</DialogTitle>
          <DialogDescription>
            Tentukan nama peran dan hak akses yang dimilikinya.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 max-h-[58vh] space-y-4 overflow-y-auto px-2 py-1 scrollbar-thin">
            <Field
              label="Nama Peran"
              htmlFor="nama"
              required
              hint="mis. Guru, Musyrif, Tata Usaha…"
              error={form.formState.errors.nama?.message}
            >
              <Input id="nama" {...form.register("nama")} />
            </Field>
            <Field
              label="Deskripsi"
              htmlFor="deskripsi"
              error={form.formState.errors.deskripsi?.message}
            >
              <Textarea
                id="deskripsi"
                placeholder="Opsional"
                {...form.register("deskripsi")}
              />
            </Field>

            {isSuper ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
                <ShieldCheck className="size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">
                  Peran administrator memiliki <b>akses penuh</b> dan tidak dapat
                  dibatasi.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Hak akses</p>
                <div className="divide-y rounded-lg border">
                  {PERMS.map((p) => (
                    <Controller
                      key={p.key}
                      control={form.control}
                      name={p.key}
                      render={({ field }) => (
                        <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {p.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {p.desc}
                            </span>
                          </span>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </label>
                      )}
                    />
                  ))}
                  <Controller
                    control={form.control}
                    name="scope_kelas"
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center justify-between gap-3 bg-muted/30 px-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            Batasi input ke kelas yang ditugaskan
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Hanya bisa input poin untuk santri di kelasnya.
                          </span>
                        </span>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </label>
                    )}
                  />
                </div>
              </div>
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
