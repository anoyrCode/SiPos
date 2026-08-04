"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { updateWaliNama } from "./actions";

const schema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(150),
});
type NamaInput = z.infer<typeof schema>;

export function WaliEditNamaDialog({
  waliId,
  initialNama,
}: {
  waliId: string;
  initialNama: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<NamaInput>({
    resolver: zodResolver(schema),
    defaultValues: { nama: initialNama },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = await updateWaliNama(waliId, values.nama);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    toast.success("Nama wali diperbarui.");
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setServerError(null);
          form.reset({ nama: initialNama });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Edit nama wali">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>Edit Nama Wali</DialogTitle>
          <DialogDescription>
            Nama ini tersendiri dari data Santri — mengedit nama wali di sini
            tidak mengubah kolom &quot;Nama Wali&quot; di data Santri, begitu
            juga sebaliknya.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 px-2 py-1">
            <Field
              label="Nama Wali"
              htmlFor="nama"
              required
              error={form.formState.errors.nama?.message}
            >
              <Input id="nama" {...form.register("nama")} />
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
