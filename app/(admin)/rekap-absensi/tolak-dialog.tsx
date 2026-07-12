"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { tolakPengajuan } from "./actions";

export function TolakDialog({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!alasan.trim()) {
      setError("Alasan penolakan wajib diisi.");
      return;
    }
    setPending(true);
    const res = await tolakPengajuan(id, alasan);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setOpen(false);
    setAlasan("");
    setError(null);
    toast.success("Pengajuan ditolak.");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setAlasan("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <X data-icon="inline-start" />
          Tolak
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tolak Pengajuan</DialogTitle>
          <DialogDescription>
            Hari yang diajukan akan kembali dievaluasi normal (bisa jadi Alpa).
          </DialogDescription>
        </DialogHeader>
        <Field label="Alasan Penolakan" htmlFor="alasan" required>
          <Textarea
            id="alasan"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Memproses…" : "Tolak Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
