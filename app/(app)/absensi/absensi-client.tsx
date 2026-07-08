"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { formatDateID } from "@/lib/format";
import { STATUS_LABEL, formatJamWIB, type AbsensiStatus } from "@/lib/absensi-status";
import { clockIn, clockOut } from "./actions";

export type AbsensiHistoryRow = {
  tanggal: string;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  status: AbsensiStatus;
};

const STATUS_VARIANT: Record<
  AbsensiStatus,
  "default" | "primary" | "positive" | "negative" | "warning" | "outline"
> = {
  normal: "positive",
  telat: "warning",
  curang: "negative",
  telat_clock_out: "negative",
  belum_clock_out: "warning",
  alpa: "negative",
  libur: "outline",
  belum_absen: "outline",
};

/** Jam:menit:detik WIB dari objek Date, format 24 jam (mis. "14:32:07"). */
function formatClockWIB(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

export function AbsensiClient({
  hasJadwal,
  jamMasukJadwal,
  jamPulangJadwal,
  jamMasukAktual,
  jamPulangAktual,
  todayStatus,
  history,
}: {
  hasJadwal: boolean;
  jamMasukJadwal: string | null;
  jamPulangJadwal: string | null;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  todayStatus: AbsensiStatus;
  history: AbsensiHistoryRow[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!hasJadwal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [hasJadwal]);

  const sudahClockIn = !!jamMasukAktual;
  const sudahClockOut = !!jamPulangAktual;

  function getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Browser tidak mendukung lokasi."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
  }

  async function handleClock(action: "in" | "out") {
    setLoading(true);
    try {
      const pos = await getLocation();
      const fn = action === "in" ? clockIn : clockOut;
      const res = await fn(pos.coords.latitude, pos.coords.longitude);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(action === "in" ? "Clock in berhasil." : "Clock out berhasil.");
      router.refresh();
    } catch {
      toast.error("Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.");
    } finally {
      setLoading(false);
    }
  }

  const columns: Column<AbsensiHistoryRow>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) => formatDateID(r.tanggal),
    },
    {
      key: "masuk",
      header: "Clock In",
      cell: (r) => <span className="font-mono">{formatJamWIB(r.jamMasukAktual)}</span>,
    },
    {
      key: "pulang",
      header: "Clock Out",
      cell: (r) => <span className="font-mono">{formatJamWIB(r.jamPulangAktual)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          {!hasJadwal ? (
            <p className="text-sm text-muted-foreground">
              Jadwal absensi Anda belum diatur admin. Hubungi admin untuk mengaktifkan absensi.
            </p>
          ) : (
            <>
              {now && (
                <p className="font-mono text-4xl font-bold tabular-nums tracking-tight">
                  {formatClockWIB(now)}
                </p>
              )}
              {(jamMasukJadwal || jamPulangJadwal) && (
                <p className="text-xs text-muted-foreground">
                  Jadwal: {jamMasukJadwal ?? "—"} – {jamPulangJadwal ?? "—"}
                </p>
              )}

              {!sudahClockIn ? (
                <Button
                  onClick={() => handleClock("in")}
                  disabled={loading}
                  size="lg"
                  className="h-14 w-full max-w-xs text-base"
                >
                  <LogIn data-icon="inline-start" />
                  {loading ? "Memproses…" : "Clock In"}
                </Button>
              ) : !sudahClockOut ? (
                <div className="flex w-full max-w-xs flex-col items-center gap-3">
                  <Badge variant="positive">Clock in {formatJamWIB(jamMasukAktual)}</Badge>
                  <Button
                    onClick={() => handleClock("out")}
                    disabled={loading}
                    size="lg"
                    variant="outline"
                    className="h-14 w-full text-base"
                  >
                    <LogOut data-icon="inline-start" />
                    {loading ? "Memproses…" : "Clock Out"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="font-mono text-sm">
                    {formatJamWIB(jamMasukAktual)} → {formatJamWIB(jamPulangAktual)}
                  </p>
                  <Badge variant={STATUS_VARIANT[todayStatus]}>
                    {STATUS_LABEL[todayStatus]}
                  </Badge>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Riwayat 14 Hari Terakhir</h2>

        <div className="hidden md:block">
          <DataTable
            columns={columns}
            rows={history}
            getRowId={(r) => r.tanggal}
            empty="Belum ada riwayat absensi."
          />
        </div>

        <div className="space-y-2 md:hidden">
          {history.length === 0 ? (
            <p className="rounded-card border border-border/70 bg-card p-4 text-center text-sm text-muted-foreground">
              Belum ada riwayat absensi.
            </p>
          ) : (
            history.map((r) => (
              <div
                key={r.tanggal}
                className="rounded-card border border-border/70 bg-card p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{formatDateID(r.tanggal)}</span>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatJamWIB(r.jamMasukAktual)} → {formatJamWIB(r.jamPulangAktual)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
