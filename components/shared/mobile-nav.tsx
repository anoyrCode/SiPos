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
import { logout } from "@/lib/auth/actions";
import type { NavGroup } from "@/lib/auth/roles";

export function MobileNav({ nav }: { nav: NavGroup[] }) {
  const [open, setOpen] = useState(false);

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
        <form action={logout}>
          <Button type="submit" variant="outline" className="w-full">
            Keluar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
