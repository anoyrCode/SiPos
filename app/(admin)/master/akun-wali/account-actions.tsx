"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2, UserPlus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createWaliAccount,
  deleteWali,
  deleteWaliAccount,
  resetWaliPassword,
} from "./actions";

export function WaliAccountActions({
  waliId,
  waliNama,
  hasAccount,
  email,
}: {
  waliId: string;
  waliNama: string;
  hasAccount: boolean;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cred, setCred] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buat() {
    setError(null);
    startTransition(async () => {
      const r = await createWaliAccount(waliId);
      if (r.ok) {
        setCred(r.password);
        router.refresh();
      } else setError(r.error);
    });
  }

  function reset() {
    setError(null);
    startTransition(async () => {
      const r = await resetWaliPassword(waliId);
      if (r.ok) setCred(r.password);
      else setError(r.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {!hasAccount ? (
        <Button size="sm" disabled={pending} onClick={buat}>
          <UserPlus data-icon="inline-start" />
          Buat Akun
        </Button>
      ) : (
        <>
          <Button variant="outline" size="sm" disabled={pending} onClick={reset}>
            <KeyRound data-icon="inline-start" />
            Reset
          </Button>
          <ConfirmDialog
            action={deleteWaliAccount}
            id={waliId}
            title="Hapus akun wali?"
            description="Akun login akan dihapus. Data wali & relasi anak tetap tersimpan."
            confirmLabel="Hapus Akun"
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Hapus akun">
                <Trash2 />
              </Button>
            }
          />
        </>
      )}
      <ConfirmDialog
        action={deleteWali}
        id={waliId}
        title="Hapus data wali?"
        description={`Data wali "${waliNama}" akan dihapus permanen, termasuk akun login (jika ada) dan relasi ke semua anaknya.`}
        confirmLabel="Hapus"
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Hapus wali">
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
      {error && <span className="text-xs text-destructive">{error}</span>}

      <Dialog
        open={cred !== null}
        onOpenChange={(o) => {
          if (!o) setCred(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kredensial Akun Wali</DialogTitle>
            <DialogDescription>
              Bagikan ke wali. Sarankan ganti password setelah login pertama.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Username/email</span>
              <span className="font-mono">{email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Password</span>
              <span className="font-mono font-semibold">{cred}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCred(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
