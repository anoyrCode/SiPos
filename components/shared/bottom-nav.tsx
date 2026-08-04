"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dot } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/auth/roles";
import { ICONS } from "./sidebar-nav";

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICONS[item.href] ?? Dot;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
                item.comingSoon && !active && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full transition-all duration-200 ease-(--ease-smooth)",
                  active && "bg-primary/15",
                )}
              >
                <Icon className="size-[1.1rem]" />
                {item.comingSoon && !active && (
                  <span
                    aria-hidden
                    className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500"
                  />
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
