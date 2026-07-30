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
import { cn } from "@/lib/utils";

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
      <DialogContent
        className={cn(
          "left-0 top-0 flex h-full max-w-[16rem] translate-x-0 translate-y-0 flex-col gap-4 rounded-none rounded-r-card",
          // DialogContent dasar dianimasikan zoom (utk modal di tengah layar).
          // Drawer ini muncul dari tepi kiri — men-scale kotak setinggi 100vh
          // dari titik tengahnya bikin tepi atas/bawah "meloncat" (terasa
          // kasar). Ganti jadi geser murni: matikan zoom (paksa via `!`,
          // krn tailwind-merge tidak mengenali zoom-in-95 vs zoom-in-100
          // sbg kelas yg saling menggantikan) + tambah slide-in-from-left.
          "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          "data-[state=open]:zoom-in-100! data-[state=closed]:zoom-out-100!",
        )}
      >
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
