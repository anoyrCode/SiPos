"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 10px 30px -12px rgba(0,0,0,0.25)",
} as const;

export function PerkembanganSkor({
  data,
}: {
  data: { tanggal: string; skor: number }[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
        Belum cukup data untuk grafik perkembangan.
      </div>
    );
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="grad-skor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="tanggal"
            stroke="var(--muted-foreground)"
            fontSize={12}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="skor"
            name="Skor total"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#grad-skor)"
            dot={{ r: 3, strokeWidth: 0, fill: "var(--primary)" }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KomposisiPoin({ pos, neg }: { pos: number; neg: number }) {
  const total = pos + neg;
  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
        Belum ada poin.
      </div>
    );
  }
  const data = [
    { name: "Positif", value: pos, color: "var(--chart-pos)" },
    { name: "Negatif", value: neg, color: "var(--chart-neg)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-3">
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold tabular-nums">
            {pos + neg}
          </span>
          <span className="text-[11px] text-muted-foreground">total poin</span>
        </div>
      </div>
      <ul className="flex justify-center gap-4">
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full bg-chart-pos" />
          <span className="font-medium text-foreground">Positif</span>
          <span className="tabular-nums">({pos})</span>
        </li>
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full bg-chart-neg" />
          <span className="font-medium text-foreground">Negatif</span>
          <span className="tabular-nums">({neg})</span>
        </li>
      </ul>
    </div>
  );
}
