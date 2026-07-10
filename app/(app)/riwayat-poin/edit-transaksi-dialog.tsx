"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";

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
import { editTransaksiSchema, type EditTransaksiInput } from "./schema";
import { updateTransaksi } from "./actions";

export function EditTransaksiDialog({
  id,
  santriNama,
  poinNama,
  initial,
}: {
  id: string;
  santriNama: string;
  poinNama: string;
  initial: EditTransaksiInput;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<EditTransaksiInput>({
    resolver: zodResolver(editTransaksiSchema),
    defaultValues: initial,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = await updateTransaksi(id, values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success("Transaksi poin diperbarui.");
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
        <Button variant="ghost" size="icon-sm" aria-label="Edit">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>Edit Transaksi Poin</DialogTitle>
          <DialogDescription>
            {santriNama} · {poinNama}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 space-y-4 px-2 py-1">
            <Field
              label="Tanggal Kejadian"
              htmlFor="tanggal_kejadian"
              required
              error={form.formState.errors.tanggal_kejadian?.message}
            >
              <Input
                id="tanggal_kejadian"
                type="date"
                {...form.register("tanggal_kejadian")}
              />
            </Field>
            <Field
              label="Nilai Poin"
              htmlFor="nilai_poin"
              required
              hint="Mengubah nilai akan ditandai sebagai override."
              error={form.formState.errors.nilai_poin?.message}
            >
              <Input
                id="nilai_poin"
                type="number"
                {...form.register("nilai_poin", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Catatan"
              htmlFor="catatan"
              error={form.formState.errors.catatan?.message}
            >
              <Input id="catatan" {...form.register("catatan")} />
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
