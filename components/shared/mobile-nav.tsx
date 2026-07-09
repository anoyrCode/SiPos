"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { SiposMark } from "./sipos-mark";
import { initials } from "./app-shell";
import { logout } from "@/lib/auth/actions";
import type { NavGroup } from "@/lib/auth/roles";

export function MobileNav({
  nav,
  name,
  subLabel,
}: {
  nav: NavGroup[];
  name: string;
  subLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ini = initials(name);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Buka menu">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 flex h-full max-w-[16rem] translate-x-0 translate-y-0 flex-col gap-4 rounded-none rounded-r-card">
        <DialogTitle className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight">
          <SiposMark className="size-8" />
          <span>
            <span className="text-foreground">SIPOS</span>{" "}
            <span className="text-primary">Al-Kautsar</span>
          </span>
        </DialogTitle>
        <div className="-mx-2 flex-1 overflow-y-auto px-2">
          <SidebarNav nav={nav} onNavigate={() => setOpen(false)} />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-linear-to-br from-muted/50 to-transparent p-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-[#00b4d8] text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25">
            {ini}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold capitalize text-foreground/90">
              {name}
            </p>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {subLabel}
            </p>
          </div>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" className="w-full">
            Keluar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
