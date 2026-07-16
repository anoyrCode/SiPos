"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toggleJabatanAktif, toggleJabatanGuru } from "./actions";
import type { JabatanRow } from "./schema";

export function JabatanDialog({ rows }: { rows: JabatanRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onToggleAktif(row: JabatanRow) {
    setPendingId(row.id);
    const res = await toggleJabatanAktif(row.id, !row.is_aktif);
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(row.is_aktif ? "Jabatan dinonaktifkan." : "Jabatan diaktifkan.");
    router.refresh();
  }

  async function onToggleGuru(row: JabatanRow, isGuru: boolean) {
    setPendingId(row.id);
    const res = await toggleJabatanGuru(row.id, isGuru);
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pengaturan KPI Guru diperbarui.");
    router.refresh();
  }

  const sorted = [...rows].sort((a, b) => {
    if (a.is_aktif !== b.is_aktif) return a.is_aktif ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ListChecks data-icon="inline-start" />
          Kelola Jabatan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kelola Jabatan</DialogTitle>
          <DialogDescription>
            Aktifkan/nonaktifkan jabatan yang muncul di dropdown form Pegawai,
            dan atur mana yang dihitung sebagai Guru di KPI Dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada jabatan. Tambah lewat form Pegawai (pilih &quot;Lainnya&quot;).
            </p>
          ) : (
            sorted.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
              >
                <span
                  className={
                    row.is_aktif
                      ? "text-sm font-medium"
                      : "text-sm font-medium text-muted-foreground line-through"
                  }
                >
                  {row.nama}
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Hitung sbg Guru
                    <Switch
                      checked={row.is_guru}
                      disabled={pendingId === row.id}
                      onCheckedChange={(checked) => onToggleGuru(row, checked)}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pendingId === row.id}
                    onClick={() => onToggleAktif(row)}
                  >
                    {row.is_aktif ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
