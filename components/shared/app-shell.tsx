import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import type { NavGroup } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { SiposMark } from "./sipos-mark";
import { NavCurrentTitle } from "./nav-current-title";
import { ThemeToggle } from "./theme-toggle";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s.\-_]+/).filter(Boolean);
  const s =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
  return (s || "?").toUpperCase();
}

export function AppShell({
  nav,
  name,
  roleLabel,
  email,
  children,
}: {
  nav: NavGroup[];
  name: string;
  roleLabel: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const ini = initials(name);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="relative flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
          />
          <SiposMark className="size-8 drop-shadow-sm" />
          <div className="leading-tight">
            <p className="font-heading text-sm font-bold tracking-tight">
              <span className="text-foreground">SIPOS</span>{" "}
              <span className="text-primary">Al-Kautsar</span>
            </p>
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
              Poin Santri
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
          <SidebarNav nav={nav} />
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-linear-to-br from-muted/50 to-transparent p-2 transition-colors hover:border-primary/30">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-[#00b4d8] text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25">
              {ini}
            </span>
            <div className="min-w-0 flex-1">
              <p
                title={email ?? undefined}
                className="truncate text-xs font-semibold capitalize text-foreground/90"
              >
                {name}
              </p>
              <p className="truncate text-[0.7rem] text-muted-foreground">
                {roleLabel}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <form action={logout}>
                <Button type="submit" variant="ghost" size="icon-sm" aria-label="Keluar">
                  <LogOut />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <MobileNav nav={nav} />
            <NavCurrentTitle nav={nav} />
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <form action={logout}>
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Keluar">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
