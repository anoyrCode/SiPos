"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  CalendarDays,
  ClipboardCheck,
  Dot,
  FileBarChart2,
  Fingerprint,
  GraduationCap,
  HeartPulse,
  History,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MailWarning,
  Network,
  School,
  ShieldCheck,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/auth/roles";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/input-poin": SquarePen,
  "/riwayat-poin": History,
  "/laporan": FileBarChart2,
  "/surat-panggilan": MailWarning,
  "/absensi": Fingerprint,
  "/rekap-absensi": ClipboardCheck,
  "/master/santri": GraduationCap,
  "/master/pegawai": Users,
  "/master/poin-positif": ThumbsUp,
  "/master/poin-negatif": ThumbsDown,
  "/master/level-poin": Award,
  "/master/kelas": School,
  "/master/level-pendidikan": Layers,
  "/master/tahun-ajaran": CalendarDays,
  "/master/kelas-wali": Network,
  "/master/penugasan-guru": UserCheck,
  "/master/akun-staff": UsersRound,
  "/master/akun-wali": UserCog,
  "/master/peran": ShieldCheck,
  "/uks": HeartPulse,
  "/anak": Users,
};


export function SidebarNav({
  nav,
  onNavigate,
}: {
  nav: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-4">
      {nav.map((group, i) => (
        <div key={group.title ?? `group-${i}`} className="space-y-0.5">
          {group.title && (
            <p className="flex items-center gap-2 px-3 pb-2 pt-1 text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">
              <span className="h-px w-3 bg-border" aria-hidden />
              {group.title}
            </p>
          )}
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = ICONS[item.href] ?? Dot;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/nav relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ease-(--ease-smooth)",
                  active
                    ? "bg-linear-to-r from-primary/15 to-primary/3 text-primary"
                    : "text-muted-foreground hover:translate-x-0.5 hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {/* Accent bar kiri — tumbuh saat aktif/hover */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300 ease-(--ease-smooth)",
                    active
                      ? "h-5 opacity-100"
                      : "h-0 opacity-0 group-hover/nav:h-3 group-hover/nav:opacity-60",
                  )}
                />
                {/* Chip ikon — terisi penuh saat aktif, menyala saat hover */}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ease-(--ease-smooth)",
                    active
                      ? "scale-105 bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                      : "text-muted-foreground group-hover/nav:bg-primary/10 group-hover/nav:text-primary",
                  )}
                >
                  <Icon className="size-[1.05rem]" />
                </span>
                <span className="truncate">{item.label}</span>
                {!!item.badge && (
                  <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.62rem] font-semibold text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
                {/* Titik penanda aktif di kanan */}
                {active && !item.badge && (
                  <span
                    aria-hidden
                    className="ml-auto size-1.5 rounded-full bg-primary/70"
                  />
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
