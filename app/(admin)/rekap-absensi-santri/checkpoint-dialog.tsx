"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { addCheckpoint, deleteCheckpoint } from "./actions";

export type CheckpointRow = { id: string; shift: number; jam: string; urutan: number };

export function CheckpointDialog({ checkpoints }: { checkpoints: CheckpointRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState("1");
  const [jam, setJam] = useState("");
  const [urutan, setUrutan] = useState("");

  async function onAdd() {
    setError(null);
    if (!jam || !urutan) {
      setError("Jam dan urutan wajib diisi.");
      return;
    }
    setPending(true);
    const res = await addCheckpoint(Number(shift), jam, Number(urutan));
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setJam("");
    setUrutan("");
    toast.success("Checkpoint ditambahkan.");
    router.refresh();
  }

  const byShift = [1, 2, 3].map((s) => ({
    shift: s,
    items: checkpoints.filter((c) => c.shift === s).sort((a, b) => a.urutan - b.urutan),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Clock data-icon="inline-start" />
          Atur Jam Checkpoint
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atur Jam Checkpoint</DialogTitle>
          <DialogDescription>
            Daftar jam absensi santri per shift. Urutan menentukan urutan tampil (bukan
            diurutkan dari jam — shift 3 melewati tengah malam).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Shift" htmlFor="checkpoint-shift">
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger id="checkpoint-shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Shift 1</SelectItem>
                <SelectItem value="2">Shift 2</SelectItem>
                <SelectItem value="3">Shift 3</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Jam" htmlFor="checkpoint-jam">
            <Input
              id="checkpoint-jam"
              type="time"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
            />
          </Field>
          <Field label="Urutan" htmlFor="checkpoint-urutan">
            <Input
              id="checkpoint-urutan"
              type="number"
              min={1}
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
            />
          </Field>
          <Button type="button" onClick={onAdd} disabled={pending}>
            <Plus data-icon="inline-start" />
            Tambah
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {byShift.map((group) => (
            <div key={group.shift} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Shift {group.shift}
              </p>
              {group.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada checkpoint.</p>
              ) : (
                group.items.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
                  >
                    <span className="font-mono text-sm">{c.jam.slice(0, 5)}</span>
                    <ConfirmDialog
                      action={deleteCheckpoint}
                      id={c.id}
                      title="Hapus checkpoint?"
                      description={`Checkpoint ${c.jam.slice(0, 5)} shift ${c.shift} akan dihapus. Data absensi yang sudah tercatat di checkpoint ini ikut terhapus.`}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                          <Trash2 />
                        </Button>
                      }
                    />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
