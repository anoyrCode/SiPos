"use client";

import { useState } from "react";
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

export function AbsensiClient({
  hasJadwal,
  sudahClockIn,
  sudahClockOut,
  history,
}: {
  hasJadwal: boolean;
  sudahClockIn: boolean;
  sudahClockOut: boolean;
  history: AbsensiHistoryRow[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
          {!hasJadwal ? (
            <p className="text-sm text-muted-foreground">
              Jadwal absensi Anda belum diatur admin. Hubungi admin untuk mengaktifkan absensi.
            </p>
          ) : !sudahClockIn ? (
            <>
              <p className="text-sm text-muted-foreground">
                Anda belum clock in hari ini.
              </p>
              <Button onClick={() => handleClock("in")} disabled={loading}>
                <LogIn data-icon="inline-start" />
                {loading ? "Memproses…" : "Clock In"}
              </Button>
            </>
          ) : !sudahClockOut ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sudah clock in. Jangan lupa clock out.
              </p>
              <Button onClick={() => handleClock("out")} disabled={loading}>
                <LogOut data-icon="inline-start" />
                {loading ? "Memproses…" : "Clock Out"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Absensi hari ini sudah lengkap (clock in & clock out).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Riwayat 14 Hari Terakhir</h2>
        <DataTable
          columns={columns}
          rows={history}
          getRowId={(r) => r.tanggal}
          empty="Belum ada riwayat absensi."
        />
      </div>
    </div>
  );
}
