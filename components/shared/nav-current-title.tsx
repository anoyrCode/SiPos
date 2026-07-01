"use client";

import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/auth/roles";

export function NavCurrentTitle({ nav }: { nav: NavGroup[] }) {
  const pathname = usePathname();

  for (const group of nav) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return (
          <span className="truncate font-heading text-sm font-semibold text-foreground">
            {item.label}
          </span>
        );
      }
    }
  }

  return (
    <span className="font-heading text-sm font-bold tracking-tight">
      <span className="text-foreground">SIPOS</span>{" "}
      <span className="text-primary">Al-Kautsar</span>
    </span>
  );
}
