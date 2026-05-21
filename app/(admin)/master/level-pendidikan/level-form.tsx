"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Field } from "@/components/shared/field";
import { levelSchema, type LevelInput } from "./schema";
import { createLevel, updateLevel } from "./actions";

export type LevelRow = { id: string; nama: string; urutan: number };

export function LevelForm({ initial }: { initial?: LevelRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: LevelInput = {
    nama: initial?.nama ?? "",
    urutan: initial?.urutan ?? 0,
  };

  const form = useForm<LevelInput>({
    resolver: zodResolver(levelSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = initial
      ? await updateLevel(initial.id, values)
      : await createLevel(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    if (!initial) form.reset({ nama: "", urutan: 0 });
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
            Tambah Level
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Level Pendidikan" : "Tambah Level Pendidikan"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Nama"
            htmlFor="nama"
            required
            error={form.formState.errors.nama?.message}
          >
            <Input id="nama" placeholder="mis. MTS" {...form.register("nama")} />
          </Field>
          <Field
            label="Urutan"
            htmlFor="urutan"
            hint="Untuk pengurutan tampilan."
            error={form.formState.errors.urutan?.message}
          >
            <Input
              id="urutan"
              type="number"
              {...form.register("urutan", { valueAsNumber: true })}
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
