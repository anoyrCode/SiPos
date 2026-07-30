"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PerluPerhatianItem = { id: string; nama: string; total: number };
type GenderFilter = "all" | "L" | "P";

const GENDER_TABS: { key: GenderFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "L", label: "Laki-laki" },
  { key: "P", label: "Perempuan" },
];

export function PerluPerhatianList({
  items,
}: {
  items: Record<GenderFilter, PerluPerhatianItem[]>;
}) {
  const [gender, setGender] = useState<GenderFilter>("all");
  const list = items[gender];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {GENDER_TABS.map((t) => (
          <Button
            key={t.key}
            size="xs"
            variant={gender === t.key ? "default" : "outline"}
            onClick={() => setGender(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada santri dengan poin negatif. 🎉
        </p>
      ) : (
        <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
          {list.map((s, idx) => (
            <li key={s.id}>
              <Link
                href={`/santri/${s.id}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-negative-soft text-xs font-semibold text-negative">
                  {idx + 1}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {s.nama}
                </span>
                <Badge variant="negative" className="font-mono">
                  −{s.total}
                </Badge>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
