import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { getProfile } from "@/lib/auth/dal";
import { homePathForProfile } from "@/lib/auth/roles";
import { SiposMark } from "@/components/shared/sipos-mark";
import { LoginForm } from "@/components/auth/login-form";

const FEATURES = [
  "Catat poin positif & negatif santri",
  "Dashboard & laporan per kelas/santri",
  "Portal wali: pantau perkembangan anak",
];

export default async function LoginPage() {
  const profile = await getProfile();
  if (profile) redirect(homePathForProfile(profile));

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Panel brand */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{
          backgroundImage:
            "linear-gradient(140deg, #00b4d8 0%, #0092b7 50%, #036985 100%)",
        }}
      >
        {/* Lingkaran lembut mengambang */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-28 -top-28 size-104 rounded-full bg-white/12 blur-3xl motion-safe:animate-[float_14s_ease-in-out_infinite]" />
          <div className="absolute -right-24 top-1/4 size-80 rounded-full bg-cyan-200/25 blur-3xl motion-safe:animate-[float_18s_ease-in-out_infinite_reverse]" />
          <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-white/12 blur-3xl motion-safe:animate-[float_16s_ease-in-out_infinite]" />
        </div>
        {/* Sheen cahaya dari atas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(75% 55% at 50% -8%, rgba(255,255,255,0.20), transparent 60%)",
          }}
        />
        {/* Grid garis halus + titik */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(110% 110% at 50% 0%, #000 55%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(110% 110% at 50% 0%, #000 55%, transparent 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Motif bintang khatam */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          className="pointer-events-none absolute -bottom-28 -right-28 size-[34rem] text-white/10 motion-safe:animate-[spin_120s_linear_infinite]"
        >
          <rect x="24" y="24" width="52" height="52" rx="2" />
          <rect x="24" y="24" width="52" height="52" rx="2" transform="rotate(45 50 50)" />
          <circle cx="50" cy="50" r="40" />
          <circle cx="50" cy="50" r="30" />
        </svg>

        <div className="animate-enter relative flex items-center gap-3">
          <SiposMark className="size-12 drop-shadow-md" />
          <span className="font-heading text-2xl font-extrabold tracking-tight">
            <span className="text-white">SIPOS</span>{" "}
            <span className="text-cyan-200">Al-Kautsar</span>
          </span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1
            className="animate-enter font-heading text-[2.5rem] font-bold leading-[1.08] tracking-tight"
            style={{ animationDelay: "80ms" }}
          >
            Pantau poin santri
            <br />
            dengan tenang &amp; rapi.
          </h1>
          <p
            className="animate-enter max-w-sm text-[0.95rem] leading-relaxed text-white/85"
            style={{ animationDelay: "150ms" }}
          >
            Sistem Informasi Poin Santri — satu tempat untuk pencatatan,
            monitoring, dan pelaporan poin pesantren.
          </p>
          <ul className="space-y-2.5">
            {FEATURES.map((f, i) => (
              <li
                key={f}
                className="animate-enter flex items-center gap-3 text-sm text-white/90"
                style={{ animationDelay: `${230 + i * 70}ms` }}
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <Check className="size-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p
          className="animate-enter relative text-xs text-white/60"
          style={{ animationDelay: "560ms" }}
        >
          © {new Date().getFullYear()} SIPOS
        </p>
      </aside>

      {/* Panel form */}
      <section className="relative flex items-center justify-center overflow-hidden bg-background p-6 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--primary) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full bg-cyan-200/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-1/4 right-0 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <LoginForm />
      </section>
    </main>
  );
}
