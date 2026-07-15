"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Plus } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { pegawaiSchema, type PegawaiInput, type PegawaiRow } from "./schema";
import { createPegawai, updatePegawai } from "./actions";

export const JABATAN_OPTIONS = [
  "Musyrif",
  "Musyrifah",
  "Kesantrian Akhwat",
  "Kesantrian Ikhwan",
  "Humas",
  "Tim Media",
  "IT Support (TU)",
  "IT Development",
  "Tim Keamanan",
  "Guru Profesional",
  "Tim Kurikulum",
  "Administrasi",
  "SDM",
  "Tim Kesehatan",
  "Tim Kepala Sekolah",
  "Tim Maintenance Umum",
  "Tim Maintenance AC",
  "Tim Maintenance Kelistrikan",
  "Bagian Dapur/Konsumsi",
  "Bagian Kantin",
  "Tim Percetakan",
];

const HARI_OPTIONS = [
  { value: "0", label: "Minggu" },
  { value: "1", label: "Senin" },
  { value: "2", label: "Selasa" },
  { value: "3", label: "Rabu" },
  { value: "4", label: "Kamis" },
  { value: "5", label: "Jumat" },
  { value: "6", label: "Sabtu" },
];

export function PegawaiForm({ initial }: { initial?: PegawaiRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: PegawaiInput = {
    nip: initial?.nip ?? "",
    nama: initial?.nama ?? "",
    email: initial?.email ?? "",
    jabatan: initial?.jabatan ?? "",
    jabatan_tambahan: initial?.jabatan_tambahan ?? [],
    jenis_kelamin: initial?.jenis_kelamin ?? undefined,
    telp: initial?.telp ?? "",
    tempat_lahir: initial?.tempat_lahir ?? "",
    tanggal_lahir: initial?.tanggal_lahir ?? "",
    alamat: initial?.alamat ?? "",
    jam_masuk_jadwal: initial?.jam_masuk_jadwal ?? "",
    jam_pulang_jadwal: initial?.jam_pulang_jadwal ?? "",
    hari_libur:
      initial?.hari_libur !== null && initial?.hari_libur !== undefined
        ? String(initial.hari_libur)
        : "",
    jadwal_fleksibel: initial?.jadwal_fleksibel ?? false,
    jadwal_harian_berbeda: initial?.jadwal_harian_berbeda ?? false,
    shift_ganda: initial?.shift_ganda ?? false,
    jam_masuk_jadwal_2: initial?.jam_masuk_jadwal_2 ?? "",
    jam_pulang_jadwal_2: initial?.jam_pulang_jadwal_2 ?? "",
    jadwal_harian: (
      initial?.jadwal_harian ??
      Array.from({ length: 7 }, () => ({ jam_masuk: null, jam_pulang: null }))
    ).map((slot) => ({
      jam_masuk: slot.jam_masuk ?? "",
      jam_pulang: slot.jam_pulang ?? "",
    })),
  };

  const form = useForm<PegawaiInput>({
    resolver: zodResolver(pegawaiSchema),
    defaultValues: defaults,
  });
  const jadwalFleksibel = useWatch({
    control: form.control,
    name: "jadwal_fleksibel",
  });
  const jadwalHarianBerbeda = useWatch({
    control: form.control,
    name: "jadwal_harian_berbeda",
  });
  const shiftGanda = useWatch({
    control: form.control,
    name: "shift_ganda",
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
                  error={form.formState.errors.jabatan?.message}
                >
                  <Controller
                    control={form.control}
                    name="jabatan"
                    render={({ field }) => {
                      const isPreset = JABATAN_OPTIONS.includes(field.value ?? "");
                      const selectValue = field.value
                        ? isPreset
                          ? field.value
                          : "Lainnya"
                        : undefined;
                      return (
                        <div className="space-y-2">
                          <Select
                            value={selectValue}
                            onValueChange={(v) =>
                              field.onChange(v === "Lainnya" ? "" : v)
                            }
                          >
                            <SelectTrigger id="jabatan">
                              <SelectValue placeholder="Pilih jabatan" />
                            </SelectTrigger>
                            <SelectContent>
                              {JABATAN_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                              <SelectItem value="Lainnya">Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                          {selectValue === "Lainnya" && (
                            <Input
                              placeholder="Tulis jabatan"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          )}
                        </div>
                      );
                    }}
                  />
                </Field>
                <Field
                  label="Jabatan Tambahan"
                  className="sm:col-span-2"
                  hint="Opsional — jabatan lain di luar jabatan utama."
                  error={form.formState.errors.jabatan_tambahan?.message}
                >
                  <Controller
                    control={form.control}
                    name="jabatan_tambahan"
                    render={({ field }) => {
                      const selected = field.value ?? [];
                      function toggle(opt: string) {
                        field.onChange(
                          selected.includes(opt)
                            ? selected.filter((o) => o !== opt)
                            : [...selected, opt],
                        );
                      }
                      return (
                        <div className="flex flex-wrap gap-2">
                          {JABATAN_OPTIONS.map((opt) => {
                            const on = selected.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggle(opt)}
                                aria-pressed={on}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                                  on
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:bg-muted",
                                )}
                              >
                                {on && <Check className="size-3" />}
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
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

            <div className="h-px bg-border" />

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Jadwal Absensi
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="jadwal_fleksibel"
                  render={({ field }) => (
                    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2">
                      <span className="text-sm font-medium">
                        Jadwal Fleksibel
                        <span className="block text-xs font-normal text-muted-foreground">
                          Tidak terikat jam masuk/pulang tetap (mis. satpam).
                        </span>
                      </span>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("jam_masuk_jadwal", "");
                            form.setValue("jam_pulang_jadwal", "");
                            form.setValue("jadwal_harian_berbeda", false);
                            form.setValue("shift_ganda", false);
                          }
                        }}
                      />
                    </label>
                  )}
                />
                <Controller
                  control={form.control}
                  name="jadwal_harian_berbeda"
                  render={({ field }) => (
                    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2">
                      <span className="text-sm font-medium">
                        Jadwal Beda per Hari
                        <span className="block text-xs font-normal text-muted-foreground">
                          Jam masuk/pulang berbeda tiap hari (mis. Selasa
                          siang-malam, hari lain pagi-siang).
                        </span>
                      </span>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("jam_masuk_jadwal", "");
                            form.setValue("jam_pulang_jadwal", "");
                            form.setValue("jadwal_fleksibel", false);
                            form.setValue("shift_ganda", false);
                          }
                        }}
                      />
                    </label>
                  )}
                />
                <Controller
                  control={form.control}
                  name="shift_ganda"
                  render={({ field }) => (
                    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2">
                      <span className="text-sm font-medium">
                        Shift Ganda
                        <span className="block text-xs font-normal text-muted-foreground">
                          2 sesi kerja terpisah dalam 1 hari (mis. pagi
                          06:00–12:00, malam 19:00–21:00).
                        </span>
                      </span>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("jadwal_fleksibel", false);
                            form.setValue("jadwal_harian_berbeda", false);
                          } else {
                            form.setValue("jam_masuk_jadwal_2", "");
                            form.setValue("jam_pulang_jadwal_2", "");
                          }
                        }}
                      />
                    </label>
                  )}
                />
                {!jadwalHarianBerbeda && (
                  <>
                    <Field
                      label={shiftGanda ? "Jam Masuk (Sesi 1)" : "Jam Masuk"}
                      htmlFor="jam_masuk_jadwal"
                      error={form.formState.errors.jam_masuk_jadwal?.message}
                    >
                      <Input
                        id="jam_masuk_jadwal"
                        type="time"
                        disabled={jadwalFleksibel}
                        {...form.register("jam_masuk_jadwal")}
                      />
                    </Field>
                    <Field
                      label={shiftGanda ? "Jam Pulang (Sesi 1)" : "Jam Pulang"}
                      htmlFor="jam_pulang_jadwal"
                      error={form.formState.errors.jam_pulang_jadwal?.message}
                    >
                      <Input
                        id="jam_pulang_jadwal"
                        type="time"
                        disabled={jadwalFleksibel}
                        {...form.register("jam_pulang_jadwal")}
                      />
                    </Field>
                  </>
                )}
                {shiftGanda && (
                  <>
                    <Field
                      label="Jam Masuk (Sesi 2)"
                      htmlFor="jam_masuk_jadwal_2"
                      error={form.formState.errors.jam_masuk_jadwal_2?.message}
                    >
                      <Input
                        id="jam_masuk_jadwal_2"
                        type="time"
                        {...form.register("jam_masuk_jadwal_2")}
                      />
                    </Field>
                    <Field
                      label="Jam Pulang (Sesi 2)"
                      htmlFor="jam_pulang_jadwal_2"
                      error={form.formState.errors.jam_pulang_jadwal_2?.message}
                    >
                      <Input
                        id="jam_pulang_jadwal_2"
                        type="time"
                        {...form.register("jam_pulang_jadwal_2")}
                      />
                    </Field>
                  </>
                )}
                <Field
                  label="Hari Libur"
                  error={form.formState.errors.hari_libur?.message}
                >
                  <Controller
                    control={form.control}
                    name="hari_libur"
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih hari libur" />
                        </SelectTrigger>
                        <SelectContent>
                          {HARI_OPTIONS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
              {jadwalHarianBerbeda && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Isi jam masuk/pulang per hari. Kosongkan hari yang tidak
                    perlu dicek (mis. hari libur pegawai ini).
                  </p>
                  {HARI_OPTIONS.map((h, i) => (
                    <div
                      key={h.value}
                      className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2"
                    >
                      <span className="text-sm font-medium">{h.label}</span>
                      <Input
                        type="time"
                        aria-label={`Jam masuk ${h.label}`}
                        {...form.register(
                          `jadwal_harian.${i}.jam_masuk` as `jadwal_harian.${number}.jam_masuk`,
                        )}
                      />
                      <Input
                        type="time"
                        aria-label={`Jam pulang ${h.label}`}
                        {...form.register(
                          `jadwal_harian.${i}.jam_pulang` as `jadwal_harian.${number}.jam_pulang`,
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}
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
