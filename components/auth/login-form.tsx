"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, Sparkles } from "lucide-react";

import { login, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiposMark } from "@/components/shared/sipos-mark";
import { cn } from "@/lib/utils";

type Mode = "staff" | "wali";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("staff");
  const [showPw, setShowPw] = useState(false);
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <div className="animate-enter w-full max-w-sm rounded-2xl border bg-card p-7 shadow-xl shadow-foreground/6 sm:p-8">
      <div className="mb-7 flex items-center gap-2.5 lg:hidden">
        <SiposMark className="size-10" />
        <span className="font-heading text-xl font-extrabold tracking-tight">
          <span className="text-foreground">SIPOS</span>{" "}
          <span className="text-primary">Al-Kautsar</span>
        </span>
      </div>

      <div className="mb-6 space-y-1">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-tight">
          Assalamu&apos;alaikum
          <Sparkles className="size-5 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Masuk untuk melanjutkan ke akun Anda.
        </p>
      </div>

      {/* Segmented toggle dengan indikator geser */}
      <div className="relative mb-5 grid grid-cols-2 rounded-xl bg-muted p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-card shadow-sm transition-transform duration-300 ease-smooth"
          style={{
            transform: mode === "wali" ? "translateX(100%)" : "translateX(0)",
          }}
        />
        {(
          [
            ["staff", "Admin / Pegawai"],
            ["wali", "Wali Santri"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cn(
              "relative z-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              mode === value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="mode" value={mode} />

        {mode === "wali" ? (
          <div className="space-y-2">
            <Label htmlFor="phone">No WA / Telepon</Label>
            <div className="group relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                placeholder="08xxxxxxxxxx"
                className="pl-9"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="group relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nama@contoh.com"
                className="pl-9"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="group relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="px-9"
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
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" className="group/button w-full" disabled={pending}>
          {pending ? "Memproses…" : "Masuk"}
          {!pending && (
            <ArrowRight
              data-icon="inline-end"
              className="transition-transform group-hover/button:translate-x-0.5"
            />
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {mode === "wali"
          ? "Wali santri masuk dengan no WA/telp yang terdaftar."
          : "Hubungi admin jika lupa kredensial."}
      </p>
    </div>
  );
}
