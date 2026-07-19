"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 10px 30px -12px rgba(0,0,0,0.25)",
} as const;

/* ---- Count-up angka kartu statistik ---- */
export function CountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [n, setN] = useState(value);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      const id = requestAnimationFrame(() => setN(value));
      return () => cancelAnimationFrame(id);
    }
    const dur = 750;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{n.toLocaleString("id-ID")}</span>;
}

type Item = { label: string; count: number };

/** Potong label panjang di sumbu Y biar gak wrap jadi banyak baris — teks penuh tetap muncul di tooltip saat hover. */
function truncateLabel(label: string, max = 20): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

export function StatistikPoinChart({
  positif,
  negatif,
}: {
  positif: Item[];
  negatif: Item[];
}) {
  const [tipe, setTipe] = useState<"POSITIF" | "NEGATIF">("NEGATIF");
  const raw = tipe === "POSITIF" ? positif : negatif;
  // Label dipotong di DATA-nya sendiri (bukan cuma tickFormatter) — Recharts
  // memutuskan wrap sumbu kategori dari nilai mentahnya, jadi tickFormatter
  // gak cukup buat mencegah label panjang wrap jadi banyak baris. Teks
  // lengkap tetap disimpan di fullLabel utk ditampilkan di tooltip.
  const data = raw.map((d) => ({
    ...d,
    label: truncateLabel(d.label),
    fullLabel: d.label,
  }));
  const color = tipe === "POSITIF" ? "var(--chart-pos)" : "var(--chart-neg)";

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <Button
          size="xs"
          variant={tipe === "NEGATIF" ? "default" : "outline"}
          onClick={() => setTipe("NEGATIF")}
        >
          Negatif
        </Button>
        <Button
          size="xs"
          variant={tipe === "POSITIF" ? "default" : "outline"}
          onClick={() => setTipe("POSITIF")}
        >
          Positif
        </Button>
      </div>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Belum ada data.
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin sm:max-h-80">
          <div style={{ height: Math.max(96, data.length * 42 + 12) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                barCategoryGap="32%"
                margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
                />
                <Bar
                  dataKey="count"
                  name="Kejadian"
                  fill={color}
                  radius={[0, 5, 5, 0]}
                  maxBarSize={14}
                  background={{ fill: "var(--muted)", radius: 5 }}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--foreground)"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export function PerkembanganChart({
  data,
}: {
  data: { bulan: string; positif: number; negatif: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Belum ada data.
      </div>
    );
  }
  return (
    <div className="h-48 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="grad-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-pos)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--chart-pos)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-neg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-neg)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--chart-neg)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="bulan"
            stroke="var(--muted-foreground)"
            fontSize={12}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Area
            type="monotone"
            dataKey="positif"
            name="Positif"
            stroke="var(--chart-pos)"
            strokeWidth={2.5}
            fill="url(#grad-pos)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="negatif"
            name="Negatif"
            stroke="var(--chart-neg)"
            strokeWidth={2.5}
            fill="url(#grad-neg)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PeringkatChart({
  data,
  color,
}: {
  data: { nama: string; total: number }[];
  color: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Belum ada data.
      </div>
    );
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            stroke="var(--muted-foreground)"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="nama"
            width={130}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
          <Bar dataKey="total" name="Total" fill={color} radius={[0, 6, 6, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PoinPerKelasChart({
  data,
}: {
  data: { kelas: string; positif: number; negatif: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Belum ada data.
      </div>
    );
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={6}
          barCategoryGap="28%"
          margin={{ left: 0, right: 8, top: 12, bottom: 4 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="kelas"
            stroke="var(--muted-foreground)"
            fontSize={12}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--muted-foreground)"
            fontSize={12}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            verticalAlign="bottom"
          />
          <Bar
            dataKey="positif"
            name="Positif"
            fill="var(--chart-pos)"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
          />
          <Bar
            dataKey="negatif"
            name="Negatif"
            fill="var(--chart-neg)"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  RINGAN: "var(--chart-amber)",
  SEDANG: "var(--chart-orange)",
  BERAT: "var(--chart-neg)",
  Lainnya: "var(--chart-slate)",
};

export function LevelDonutChart({
  data,
}: {
  data: { level: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Belum ada data.
      </div>
    );
  }
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="space-y-3">
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="level"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell
                  key={d.level}
                  fill={LEVEL_COLORS[d.level] ?? "var(--chart-slate)"}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold tabular-nums">
            {total}
          </span>
          <span className="text-[11px] text-muted-foreground">kejadian</span>
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <li
            key={d.level}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: LEVEL_COLORS[d.level] ?? "var(--chart-slate)" }}
            />
            <span className="font-medium text-foreground">{d.level}</span>
            <span className="tabular-nums">({d.value})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
