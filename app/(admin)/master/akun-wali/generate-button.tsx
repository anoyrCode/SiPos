"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateWaliFromSantri } from "./actions";

export function GenerateWaliButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onConfirm() {
    setErr(null);
    startTransition(async () => {
      const r = await generateWaliFromSantri();
      if (r.ok) {
        setMsg(r.message);
        setOpen(false);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setErr(null);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary" onClick={() => setMsg(null)}>
            <RefreshCw data-icon="inline-start" />
            Generate dari Data Santri
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Akun Wali dari Data Santri?</DialogTitle>
            <DialogDescription>
              Sistem akan membuat data wali baru (belum akun login) untuk
              setiap nomor telepon wali di data Santri yang belum terdaftar.
              Data wali yang sudah ada tidak akan diduplikasi.
            </DialogDescription>
          </DialogHeader>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending ? "Memproses…" : "Ya, Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {msg && <span className="text-xs text-positive">{msg}</span>}
    </div>
  );
}
