"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, KeyRound } from "lucide-react";

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
import { changeOwnPassword } from "@/lib/auth/actions";

type FormValues = { password: string; confirm: string };

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    if (values.password.length < 6) {
      form.setError("password", { message: "Password minimal 6 karakter." });
      return;
    }
    if (values.password !== values.confirm) {
      form.setError("confirm", { message: "Konfirmasi password tidak cocok." });
      return;
    }
    const res = await changeOwnPassword(values.password);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    setOpen(false);
    form.reset();
    toast.success("Password berhasil diganti.");
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setServerError(null);
          form.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Ganti password">
          <KeyRound />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>Ganti Password</DialogTitle>
          <DialogDescription>Perbarui password akun Anda sendiri.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 space-y-4 px-2 py-1">
            <Field
              label="Password Baru"
              htmlFor="password"
              required
              error={form.formState.errors.password?.message}
            >
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  className="pr-9"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field
              label="Konfirmasi Password"
              htmlFor="confirm"
              required
              error={form.formState.errors.confirm?.message}
            >
              <Input
                id="confirm"
                type={showPw ? "text" : "password"}
                {...form.register("confirm")}
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
