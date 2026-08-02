"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";

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
import type { SpAmbang } from "@/lib/surat-panggilan";
import { updateAmbangSp } from "./actions";

const schema = z
  .object({
    ambang_sp1: z.number({ error: "Harus angka." }).int().min(1, "Minimal 1."),
    ambang_sp2: z.number({ error: "Harus angka." }).int().min(1, "Minimal 1."),
    ambang_sp3: z.number({ error: "Harus angka." }).int().min(1, "Minimal 1."),
  })
  .refine((v) => v.ambang_sp1 < v.ambang_sp2 && v.ambang_sp2 < v.ambang_sp3, {
    error: "Ambang harus naik: SP1 < SP2 < SP3.",
    path: ["ambang_sp2"],
  });

export function AmbangSpForm({ initial }: { initial: SpAmbang }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SpAmbang>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = await updateAmbangSp(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success("Ambang Surat Peringatan diperbarui.");
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setServerError(null);
          form.reset(initial);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal data-icon="inline-start" />
          Atur Ambang SP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>Atur Ambang SP</DialogTitle>
          <DialogDescription>
            Batas poin yang memicu SP 1, 2, dan 3. Hanya pelanggaran berlevel
            &quot;Hitung untuk SP&quot; yang dijumlahkan — atur levelnya di
            Master → Level Poin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 space-y-4 px-2 py-1">
            <Field
              label="Ambang SP 1"
              htmlFor="ambang_sp1"
              required
              error={form.formState.errors.ambang_sp1?.message}
            >
              <Input
                id="ambang_sp1"
                type="number"
                {...form.register("ambang_sp1", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Ambang SP 2"
              htmlFor="ambang_sp2"
              required
              error={form.formState.errors.ambang_sp2?.message}
            >
              <Input
                id="ambang_sp2"
                type="number"
                {...form.register("ambang_sp2", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Ambang SP 3"
              htmlFor="ambang_sp3"
              required
              error={form.formState.errors.ambang_sp3?.message}
            >
              <Input
                id="ambang_sp3"
                type="number"
                {...form.register("ambang_sp3", { valueAsNumber: true })}
              />
            </Field>
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
