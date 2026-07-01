"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

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
import { Field } from "@/components/shared/field";
import { createStaffAccount, updateStaffAccount } from "./actions";

type Opt = { id: string; nama: string; email?: string | null };

const NONE = "__none__";

export type StaffInitial = {
  userId: string;
  email: string | null;
  app_role_id: string | null;
  pegawai_id: string | null;
};

export function StaffAccountForm({
  roles,
  pegawai,
  initial,
}: {
  roles: Opt[];
  pegawai: Opt[];
  initial?: StaffInitial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(initial?.app_role_id ?? "");
  const [pegawaiId, setPegawaiId] = useState(initial?.pegawai_id ?? NONE);

  function reset() {
    setError(null);
    setEmail("");
    setPassword("");
    setRoleId(initial?.app_role_id ?? "");
    setPegawaiId(initial?.pegawai_id ?? NONE);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const pegId = pegawaiId === NONE ? null : pegawaiId;
    const res = initial
      ? await updateStaffAccount(initial.userId, {
          app_role_id: roleId,
          pegawai_id: pegId,
        })
      : await createStaffAccount({
          email,
          password,
          app_role_id: roleId,
          pegawai_id: pegId,
        });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    toast.success("Akun staff berhasil ditambahkan.");
    reset();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
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
            Buat Akun Staff
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>
            {initial ? "Edit Akun Staff" : "Buat Akun Staff"}
          </DialogTitle>
          <DialogDescription>
            {initial
              ? "Ubah peran atau tautan pegawai akun ini."
              : "Buat akun login staff (email + password) dan tetapkan perannya."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 max-h-[58vh] space-y-4 overflow-y-auto px-2 py-1 scrollbar-thin">
            {initial ? (
              <Field label="Email">
                <Input value={initial.email ?? ""} readOnly className="bg-muted/50" />
              </Field>
            ) : (
              <>
                <Field label="Email" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@contoh.com"
                  />
                </Field>
                <Field label="Password" required hint="Minimal 6 karakter.">
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password awal"
                  />
                </Field>
              </>
            )}

            <Field label="Peran" required>
              <Select value={roleId || undefined} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih peran" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Tautkan ke Pegawai"
              hint="Opsional — agar poin tercatat atas nama pegawai ini."
            >
              <Select
                value={pegawaiId}
                onValueChange={(v) => {
                  setPegawaiId(v);
                  // Saat buat akun: auto-isi email dari email pegawai (kalau ada).
                  if (!initial && v !== NONE) {
                    const peg = pegawai.find((p) => p.id === v);
                    if (peg?.email) setEmail(peg.email);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tidak ditautkan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tidak ditautkan</SelectItem>
                  {pegawai.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="-mx-6 -mb-6 border-t bg-muted/20 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
