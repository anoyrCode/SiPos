"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, LogIn, LogOut } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTable, type Column } from "@/components/shared/data-table";
import { formatDateID } from "@/lib/format";
import { cn } from "@/lib/utils";
import { haversineDistanceMeters } from "@/lib/geo";
import {
  STATUS_LABEL,
  formatJamWIB,
  formatSesiStatusLabel,
  type AbsensiStatus,
  type SesiStatus,
} from "@/lib/absensi-status";
import { clockIn, clockOut } from "./actions";
import { IzinDialog } from "./izin-dialog";

export type AbsensiHistoryRow = {
  tanggal: string;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  jamMasukAktual2: string | null;
  jamPulangAktual2: string | null;
  statuses: AbsensiStatus[];
  sesiStatuses: SesiStatus[];
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

/**
 * Badge status — tampil 1 badge biasa kalau cuma 1 status berlaku, atau
 * tombol "N Status" yg bisa diklik (popover) kalau lebih dari 1 (mis.
 * Terlambat masuk DAN Pulang Sebelum Waktunya di hari yang sama).
 */
function StatusBadges({ statuses }: { statuses: AbsensiStatus[] }) {
  if (statuses.length <= 1) {
    const s = statuses[0] ?? "normal";
    return <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full px-2 py-0.5 text-xs"
        >
          {statuses.length} Status
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto space-y-1.5 p-2">
        {statuses.map((s) => (
          <Badge key={s} variant={STATUS_VARIANT[s]} className="block w-fit">
            {STATUS_LABEL[s]}
          </Badge>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Varian StatusBadges utk pegawai shift-ganda — label pakai formatSesiStatusLabel (sufiks "(Sesi N)"). */
function SesiStatusBadges({ statuses }: { statuses: SesiStatus[] }) {
  if (statuses.length <= 1) {
    const s = statuses[0] ?? { sesi: 1 as const, status: "normal" as const };
    return <Badge variant={STATUS_VARIANT[s.status]}>{formatSesiStatusLabel(s)}</Badge>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full px-2 py-0.5 text-xs"
        >
          {statuses.length} Status
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto space-y-1.5 p-2">
        {statuses.map((s, i) => (
          <Badge
            key={`${s.sesi}-${s.status}-${i}`}
            variant={STATUS_VARIANT[s.status]}
            className="block w-fit"
          >
            {formatSesiStatusLabel(s)}
          </Badge>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Kartu Clock In/Out utk 1 sesi kerja — dirender 1x (pegawai biasa) atau 2x berdampingan (shift-ganda). */
function ClockCard({
  label,
  jamJadwalMasuk,
  jamJadwalPulang,
  jamAktualMasuk,
  jamAktualPulang,
  loading,
  onClockIn,
  onClockOut,
  todayStatus,
}: {
  label: string;
  jamJadwalMasuk: string | null;
  jamJadwalPulang: string | null;
  jamAktualMasuk: string | null;
  jamAktualPulang: string | null;
  loading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  todayStatus: ReactNode;
}) {
  const sudahClockIn = !!jamAktualMasuk;
  const sudahClockOut = !!jamAktualPulang;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {label && <p className="text-sm font-semibold">{label}</p>}
      {(jamJadwalMasuk || jamJadwalPulang) && (
        <p className="text-xs text-muted-foreground">
          Jadwal: {jamJadwalMasuk ?? "—"} – {jamJadwalPulang ?? "—"}
        </p>
      )}
      {!sudahClockIn ? (
        <Button
          onClick={onClockIn}
          disabled={loading}
          size="lg"
          className="h-14 w-full text-base"
        >
          <LogIn data-icon="inline-start" />
          {loading ? "Memproses…" : "Clock In"}
        </Button>
      ) : !sudahClockOut ? (
        <div className="flex w-full flex-col items-center gap-3">
          <Badge variant="positive">Clock in {formatJamWIB(jamAktualMasuk)}</Badge>
          <Button
            onClick={onClockOut}
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
            {formatJamWIB(jamAktualMasuk)} → {formatJamWIB(jamAktualPulang)}
          </p>
          {todayStatus}
        </div>
      )}
    </div>
  );
}

export function AbsensiClient({
  hasJadwal,
  jadwalFleksibel,
  shiftGanda,
  jamMasukJadwal,
  jamPulangJadwal,
  jamMasukJadwal2,
  jamPulangJadwal2,
  jamMasukAktual,
  jamPulangAktual,
  jamMasukAktual2,
  jamPulangAktual2,
  todayStatuses,
  todaySesiStatuses,
  history,
  lokasiLat,
  lokasiLong,
  radiusMeter,
}: {
  hasJadwal: boolean;
  jadwalFleksibel: boolean;
  shiftGanda: boolean;
  jamMasukJadwal: string | null;
  jamPulangJadwal: string | null;
  jamMasukJadwal2: string | null;
  jamPulangJadwal2: string | null;
  jamMasukAktual: string | null;
  jamPulangAktual: string | null;
  jamMasukAktual2: string | null;
  jamPulangAktual2: string | null;
  todayStatuses: AbsensiStatus[];
  todaySesiStatuses: SesiStatus[];
  history: AbsensiHistoryRow[];
  lokasiLat: number | null;
  lokasiLong: number | null;
  radiusMeter: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [lokasiStatus, setLokasiStatus] = useState<LokasiStatus>({ kind: "checking" });
  const [confirmAction, setConfirmAction] = useState<
    { sesi: 1 | 2; action: "in" | "out" } | null
  >(null);
  const [overridePrompt, setOverridePrompt] = useState<{
    sesi: 1 | 2;
    action: "in" | "out";
    message: string;
  } | null>(null);
  const [overrideChecked, setOverrideChecked] = useState(false);
  const [overrideAlasan, setOverrideAlasan] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [showDalilStep, setShowDalilStep] = useState(false);

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

  async function handleClock(
    sesi: 1 | 2,
    action: "in" | "out",
    override = false,
    alasan = "",
  ) {
    setLoading(true);
    try {
      const pos = await getLocation();
      const fn = action === "in" ? clockIn : clockOut;
      const res = await fn(
        pos.coords.latitude,
        pos.coords.longitude,
        override,
        alasan,
        sesi,
      );
      if (!res.ok) {
        if (res.geofenceFailed) {
          setOverridePrompt({ sesi, action, message: res.error });
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
      setShowDalilStep(false);
      router.refresh();
    } catch {
      toast.error("Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.");
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  const columns: Column<AbsensiHistoryRow>[] = shiftGanda
    ? [
        {
          key: "tanggal",
          header: "Tanggal",
          cell: (r) => formatDateID(r.tanggal),
        },
        {
          key: "sesi1",
          header: "Sesi 1",
          cell: (r) => (
            <span className="font-mono text-xs">
              {formatJamWIB(r.jamMasukAktual)} → {formatJamWIB(r.jamPulangAktual)}
            </span>
          ),
        },
        {
          key: "sesi2",
          header: "Sesi 2",
          cell: (r) => (
            <span className="font-mono text-xs">
              {formatJamWIB(r.jamMasukAktual2)} → {formatJamWIB(r.jamPulangAktual2)}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          cell: (r) => <SesiStatusBadges statuses={r.sesiStatuses} />,
        },
      ]
    : [
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
          cell: (r) => <StatusBadges statuses={r.statuses} />,
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
                !shiftGanda &&
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

              {shiftGanda ? (
                <div className="grid w-full gap-6 sm:max-w-2xl sm:grid-cols-2">
                  <ClockCard
                    label="Sesi 1"
                    jamJadwalMasuk={jamMasukJadwal}
                    jamJadwalPulang={jamPulangJadwal}
                    jamAktualMasuk={jamMasukAktual}
                    jamAktualPulang={jamPulangAktual}
                    loading={loading}
                    onClockIn={() => setConfirmAction({ sesi: 1, action: "in" })}
                    onClockOut={() => setConfirmAction({ sesi: 1, action: "out" })}
                    todayStatus={
                      <SesiStatusBadges
                        statuses={todaySesiStatuses.filter((s) => s.sesi === 1)}
                      />
                    }
                  />
                  <ClockCard
                    label="Sesi 2"
                    jamJadwalMasuk={jamMasukJadwal2}
                    jamJadwalPulang={jamPulangJadwal2}
                    jamAktualMasuk={jamMasukAktual2}
                    jamAktualPulang={jamPulangAktual2}
                    loading={loading}
                    onClockIn={() => setConfirmAction({ sesi: 2, action: "in" })}
                    onClockOut={() => setConfirmAction({ sesi: 2, action: "out" })}
                    todayStatus={
                      <SesiStatusBadges
                        statuses={todaySesiStatuses.filter((s) => s.sesi === 2)}
                      />
                    }
                  />
                </div>
              ) : (
                <ClockCard
                  label=""
                  jamJadwalMasuk={jamMasukJadwal}
                  jamJadwalPulang={jamPulangJadwal}
                  jamAktualMasuk={jamMasukAktual}
                  jamAktualPulang={jamPulangAktual}
                  loading={loading}
                  onClockIn={() => setConfirmAction({ sesi: 1, action: "in" })}
                  onClockOut={() => setConfirmAction({ sesi: 1, action: "out" })}
                  todayStatus={<StatusBadges statuses={todayStatuses} />}
                />
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
            history.map((r) => {
              const accentSource = shiftGanda
                ? r.sesiStatuses.map((s) => s.status)
                : r.statuses;
              const accentKey = accentSource.find((s) => STATUS_CARD_ACCENT[s]);
              return (
                <div
                  key={r.tanggal}
                  className={cn(
                    "rounded-card border border-border/70 bg-card p-3 shadow-sm",
                    accentKey && STATUS_CARD_ACCENT[accentKey],
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{formatDateID(r.tanggal)}</span>
                    {shiftGanda ? (
                      <SesiStatusBadges statuses={r.sesiStatuses} />
                    ) : (
                      <StatusBadges statuses={r.statuses} />
                    )}
                  </div>
                  {shiftGanda ? (
                    <div className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground">
                      <p>
                        Sesi 1: {formatJamWIB(r.jamMasukAktual)} → {formatJamWIB(r.jamPulangAktual)}
                      </p>
                      <p>
                        Sesi 2: {formatJamWIB(r.jamMasukAktual2)} → {formatJamWIB(r.jamPulangAktual2)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {formatJamWIB(r.jamMasukAktual)} → {formatJamWIB(r.jamPulangAktual)}
                    </p>
                  )}
                </div>
              );
            })
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
              {confirmAction?.action === "in" ? "Konfirmasi Clock In" : "Konfirmasi Clock Out"}
              {shiftGanda && confirmAction ? ` — Sesi ${confirmAction.sesi}` : ""}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "in"
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
              variant={confirmAction?.action === "out" ? "destructive" : "default"}
              onClick={() =>
                confirmAction && handleClock(confirmAction.sesi, confirmAction.action)
              }
              disabled={loading}
            >
              {loading
                ? "Memproses…"
                : confirmAction?.action === "in"
                  ? "Ya, Clock In"
                  : "Ya, Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overridePrompt !== null && !showDalilStep}
        onOpenChange={(o) => {
          if (!o) {
            setOverridePrompt(null);
            setOverrideChecked(false);
            setOverrideAlasan("");
            setOverrideError(null);
            setShowDalilStep(false);
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
                setShowDalilStep(true);
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

      <Dialog
        open={overridePrompt !== null && showDalilStep}
        onOpenChange={(o) => !o && setShowDalilStep(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sebelum Melanjutkan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <p dir="rtl" lang="ar" className="text-2xl leading-relaxed">
              مَنْ غَشَّنَا فَلَيْسَ مِنَّا
            </p>
            <p className="text-sm text-muted-foreground">
              &ldquo;Barang siapa menipu kami, maka ia bukan golongan kami.&rdquo;
            </p>
            <p className="text-xs text-muted-foreground">(HR. Muslim)</p>
            <p className="text-sm">
              Pastikan alasan yang Anda tulis benar dan sesuai kenyataan.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDalilStep(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (overridePrompt) {
                  handleClock(overridePrompt.sesi, overridePrompt.action, true, overrideAlasan);
                }
              }}
              disabled={loading}
            >
              {loading ? "Memproses…" : "Ya, Saya Yakin & Tidak Berbohong"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
