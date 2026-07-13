"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { formatDateID } from "@/lib/format";
import { cn } from "@/lib/utils";
import { haversineDistanceMeters } from "@/lib/geo";
import { STATUS_LABEL, formatJamWIB, type AbsensiStatus } from "@/lib/absensi-status";
import { clockIn, clockOut } from "./actions";
import { IzinDialog } from "./izin-dialog";

export type AbsensiHistoryRow = {
  tanggal: string;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  status: AbsensiStatus;
};

type LokasiStatus =
  | { kind: "checking" }
  | { kind: "dalam"; jarakMeter: number }
  | { kind: "luar"; kurangMeter: number }
  | { kind: "error" };

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
  masuk_libur: "primary",
  izin: "outline",
  sakit: "warning",
  belum_mulai: "outline",
};

/** Tint background lembut utk card mobile, cuma utk status yg perlu perhatian. */
const STATUS_CARD_ACCENT: Partial<Record<AbsensiStatus, string>> = {
  telat: "bg-warning-soft/40",
  alpa: "bg-negative-soft/40",
  masuk_libur: "bg-primary/10",
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
  jadwalFleksibel,
  jamMasukJadwal,
  jamPulangJadwal,
  jamMasukAktual,
  jamPulangAktual,
  todayStatus,
  history,
  lokasiLat,
  lokasiLong,
  radiusMeter,
}: {
  hasJadwal: boolean;
  jadwalFleksibel: boolean;
  jamMasukJadwal: string | null;
  jamPulangJadwal: string | null;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  todayStatus: AbsensiStatus;
  history: AbsensiHistoryRow[];
  lokasiLat: number | null;
  lokasiLong: number | null;
  radiusMeter: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [lokasiStatus, setLokasiStatus] = useState<LokasiStatus>({ kind: "checking" });
  const [confirmAction, setConfirmAction] = useState<"in" | "out" | null>(null);
  const [overridePrompt, setOverridePrompt] = useState<{
    action: "in" | "out";
    message: string;
  } | null>(null);
  const [overrideChecked, setOverrideChecked] = useState(false);
  const [overrideAlasan, setOverrideAlasan] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const lokasiTersedia = lokasiLat !== null && lokasiLong !== null;

  const checkLokasi = useCallback(() => {
    if (lokasiLat === null || lokasiLong === null) return;
    if (!navigator.geolocation) {
      setLokasiStatus({ kind: "error" });
      return;
    }
    setLokasiStatus({ kind: "checking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const jarak = haversineDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          lokasiLat,
          lokasiLong,
        );
        const radius = radiusMeter ?? 0;
        if (jarak <= radius) {
          setLokasiStatus({ kind: "dalam", jarakMeter: Math.round(jarak) });
        } else {
          setLokasiStatus({ kind: "luar", kurangMeter: Math.round(jarak - radius) });
        }
      },
      () => setLokasiStatus({ kind: "error" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [lokasiLat, lokasiLong, radiusMeter]);

  useEffect(() => {
    if (!hasJadwal || !lokasiTersedia) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkLokasi();
  }, [hasJadwal, lokasiTersedia, checkLokasi]);

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

  async function handleClock(action: "in" | "out", override = false, alasan = "") {
    setLoading(true);
    try {
      const pos = await getLocation();
      const fn = action === "in" ? clockIn : clockOut;
      const res = await fn(pos.coords.latitude, pos.coords.longitude, override, alasan);
      if (!res.ok) {
        if (res.geofenceFailed) {
          setOverridePrompt({ action, message: res.error });
          return;
        }
        if (override) {
          // Gagal saat submit override (mis. alasan kosong) — tampilkan di dalam modal override, bukan toast.
          setOverrideError(res.error);
          return;
        }
        toast.error(res.error);
        return;
      }
      toast.success(action === "in" ? "Clock in berhasil." : "Clock out berhasil.");
      setOverridePrompt(null);
      setOverrideChecked(false);
      setOverrideAlasan("");
      setOverrideError(null);
      router.refresh();
    } catch {
      toast.error("Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.");
    } finally {
      setLoading(false);
      setConfirmAction(null);
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
                <div className="rounded-2xl bg-primary/5 px-6 py-3">
                  <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-primary">
                    {formatClockWIB(now)}
                  </p>
                </div>
              )}
              {jadwalFleksibel ? (
                <p className="text-xs text-muted-foreground">
                  Jadwal fleksibel — tidak terikat jam masuk/pulang tetap.
                </p>
              ) : (
                (jamMasukJadwal || jamPulangJadwal) && (
                  <p className="text-xs text-muted-foreground">
                    Jadwal: {jamMasukJadwal ?? "—"} – {jamPulangJadwal ?? "—"}
                  </p>
                )
              )}

              {lokasiTersedia && (
                <div className="flex flex-col items-center gap-1">
                  {lokasiStatus.kind === "checking" && (
                    <p className="text-xs text-muted-foreground">Memeriksa lokasi…</p>
                  )}
                  {lokasiStatus.kind === "dalam" && (
                    <Badge variant="positive">
                      Dalam radius pondok ({lokasiStatus.jarakMeter}m dari titik pusat)
                    </Badge>
                  )}
                  {lokasiStatus.kind === "luar" && (
                    <Badge variant="warning">
                      Di luar radius — masih ~{lokasiStatus.kurangMeter}m lagi
                    </Badge>
                  )}
                  {lokasiStatus.kind === "error" && (
                    <p className="text-xs text-muted-foreground">
                      Tidak bisa deteksi lokasi. Aktifkan izin lokasi di browser.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={checkLokasi}
                    className="h-auto px-2 py-1 text-xs"
                  >
                    {lokasiStatus.kind === "error" ? "Coba Lagi" : "Cek Ulang"}
                  </Button>
                </div>
              )}

              {!sudahClockIn ? (
                <Button
                  onClick={() => setConfirmAction("in")}
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
                    onClick={() => setConfirmAction("out")}
                    disabled={loading}
                    size="lg"
                    variant="destructive"
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

      <div className="flex justify-center">
        <IzinDialog />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Riwayat Bulan Ini</h2>

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
                className={cn(
                  "rounded-card border border-border/70 bg-card p-3 shadow-sm",
                  STATUS_CARD_ACCENT[r.status],
                )}
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

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "in" ? "Konfirmasi Clock In" : "Konfirmasi Clock Out"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "in"
                ? "Anda akan mencatat clock in sekarang. Lanjutkan?"
                : "Anda akan mencatat clock out sekarang. Lanjutkan?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant={confirmAction === "out" ? "destructive" : "default"}
              onClick={() => confirmAction && handleClock(confirmAction)}
              disabled={loading}
            >
              {loading
                ? "Memproses…"
                : confirmAction === "in"
                  ? "Ya, Clock In"
                  : "Ya, Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overridePrompt !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOverridePrompt(null);
            setOverrideChecked(false);
            setOverrideAlasan("");
            setOverrideError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lokasi Di Luar Radius</DialogTitle>
            <DialogDescription>{overridePrompt?.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kalau lokasi Anda terdeteksi salah karena masalah GPS/sinyal HP,
              Anda tetap bisa {overridePrompt?.action === "in" ? "clock in" : "clock out"}{" "}
              dengan pernyataan berikut. Ini akan tercatat & bisa dicek admin.
            </p>
            <Field label="Alasan" htmlFor="override-alasan" required>
              <Textarea
                id="override-alasan"
                value={overrideAlasan}
                onChange={(e) => setOverrideAlasan(e.target.value)}
                placeholder="mis. GPS error, sinyal lemah di dalam gedung"
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
              <Switch checked={overrideChecked} onCheckedChange={setOverrideChecked} />
              <span className="text-sm">
                Saya menyatakan dengan sejujurnya bahwa saya benar-benar berada
                di lokasi pondok saat ini.
              </span>
            </label>
            {overrideError && (
              <p className="text-sm text-destructive">{overrideError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOverridePrompt(null);
                setOverrideChecked(false);
                setOverrideAlasan("");
                setOverrideError(null);
              }}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!overrideChecked || !overrideAlasan.trim()) {
                  setOverrideError("Centang pernyataan & isi alasan terlebih dahulu.");
                  return;
                }
                setOverrideError(null);
                if (overridePrompt) {
                  handleClock(overridePrompt.action, true, overrideAlasan);
                }
              }}
              disabled={loading}
            >
              {loading
                ? "Memproses…"
                : overridePrompt?.action === "in"
                  ? "Tetap Clock In"
                  : "Tetap Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
