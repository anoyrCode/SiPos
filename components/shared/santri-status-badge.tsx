import {
  AlertCircle,
  AlertTriangle,
  Award,
  Crown,
  ShieldCheck,
  Siren,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { SantriStatusLevel } from "@/lib/santri-status";

const CONFIG: Record<
  SantriStatusLevel,
  { label: string; icon: LucideIcon; className: string }
> = {
  teladan: {
    label: "Teladan",
    icon: Crown,
    className:
      "bg-linear-to-br from-amber-400 to-yellow-300 text-amber-950 shadow-sm shadow-amber-500/30",
  },
  sangat_baik: {
    label: "Sangat Baik",
    icon: Award,
    className: "bg-positive text-white",
  },
  terjaga_baik: {
    label: "Terjaga Baik",
    icon: ShieldCheck,
    className: "bg-positive-soft text-positive",
  },
  perlu_perhatian: {
    label: "Perlu Perhatian",
    icon: AlertCircle,
    className: "bg-warning-soft text-warning",
  },
  perlu_tindakan: {
    label: "Perlu Tindakan",
    icon: AlertTriangle,
    className: "bg-orange-500 text-white",
  },
  kritis: {
    label: "Kritis",
    icon: Siren,
    className: "bg-negative text-white animate-pulse",
  },
};

/** Varian dipakai saat badge ditumpuk di atas hero gradient biru (bukan
 *  di atas card putih) — cuma "terjaga_baik" yang butuh kontras beda,
 *  tier lain sudah cukup opaque/solid utk dua-duanya. */
const HERO_OVERRIDE: Partial<Record<SantriStatusLevel, string>> = {
  terjaga_baik: "bg-white/15 text-white",
};

export function SantriStatusBadge({
  level,
  onHero = false,
  className,
}: {
  level: SantriStatusLevel;
  onHero?: boolean;
  className?: string;
}) {
  const cfg = CONFIG[level];
  const Icon = cfg.icon;
  const styleClass = (onHero && HERO_OVERRIDE[level]) || cfg.className;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        styleClass,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {cfg.label}
    </span>
  );
}
