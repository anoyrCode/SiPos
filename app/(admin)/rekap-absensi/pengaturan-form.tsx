"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings } from "lucide-react";

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
import { Field } from "@/components/shared/field";
import { updatePengaturanAbsensi } from "./actions";

const LokasiMapPicker = dynamic(() => import("./lokasi-map-picker"), { ssr: false });

const schema = z.object({
  lokasi_lat: z.number(),
  lokasi_long: z.number(),
  radius_meter: z.number().min(10).max(5000),
  toleransi_menit: z.number().min(0).max(60),
});
type PengaturanInput = z.infer<typeof schema>;

export function PengaturanAbsensiForm({
  initial,
  triggerClassName,
}: {
  initial: {
    lokasi_lat: number | null;
    lokasi_long: number | null;
    radius_meter: number;
    toleransi_menit: number;
  };
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: PengaturanInput = {
    lokasi_lat: initial.lokasi_lat ?? 0,
    lokasi_long: initial.lokasi_long ?? 0,
    radius_meter: initial.radius_meter,
    toleransi_menit: initial.toleransi_menit,
  };

  const form = useForm<PengaturanInput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = await updatePengaturanAbsensi(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success("Pengaturan lokasi absensi diperbarui.");
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
        <Button variant="secondary" className={triggerClassName}>
          <Settings data-icon="inline-start" />
          Atur Lokasi & Radius
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Lokasi & Radius Pondok</DialogTitle>
          <DialogDescription>
            Koordinat pusat area pondok dan radius (meter) yang diizinkan untuk
            absen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {open && (
            <LokasiMapPicker
              lat={form.watch("lokasi_lat")}
              long={form.watch("lokasi_long")}
              radiusMeter={form.watch("radius_meter")}
              onChange={(lat, long) => {
                form.setValue("lokasi_lat", lat, { shouldValidate: true });
                form.setValue("lokasi_long", long, { shouldValidate: true });
              }}
            />
          )}
          <Field
            label="Latitude"
            htmlFor="lokasi_lat"
            error={form.formState.errors.lokasi_lat?.message}
          >
            <Input
              id="lokasi_lat"
              type="number"
              step="any"
              {...form.register("lokasi_lat", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Longitude"
            htmlFor="lokasi_long"
            error={form.formState.errors.lokasi_long?.message}
          >
            <Input
              id="lokasi_long"
              type="number"
              step="any"
              {...form.register("lokasi_long", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Radius (meter)"
            htmlFor="radius_meter"
            error={form.formState.errors.radius_meter?.message}
          >
            <Input
              id="radius_meter"
              type="number"
              {...form.register("radius_meter", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Toleransi Keterlambatan (menit)"
            htmlFor="toleransi_menit"
            hint="Clock-in dalam rentang ini tidak dianggap telat & tidak masuk laporan HRD."
            error={form.formState.errors.toleransi_menit?.message}
          >
            <Input
              id="toleransi_menit"
              type="number"
              {...form.register("toleransi_menit", { valueAsNumber: true })}
            />
          </Field>
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
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
