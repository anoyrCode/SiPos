"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa, { type ParseResult } from "papaparse";
import { AlertCircle, CheckCircle2, FileDown, Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type CsvColumn = { key: string; label: string; example?: string };

export type RowValidation<T> = {
  data: T;
  key: string | null;
  errors: string[];
};

type ParsedRow<T> = {
  line: number;
  display: string;
  data: T;
  key: string | null;
  errors: string[];
};

export function CsvImport<T>({
  title,
  description,
  columns,
  keyLabel,
  validateRow,
  checkExisting,
  commit,
  templateFilename,
}: {
  title: string;
  description?: string;
  columns: CsvColumn[];
  keyLabel: string;
  validateRow: (raw: Record<string, string>, line: number) => RowValidation<T>;
  checkExisting: (keys: string[]) => Promise<string[]>;
  commit: (rows: T[]) => Promise<{ ok: boolean; inserted: number; error?: string }>;
  templateFilename: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow<T>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(false);

  function reset() {
    setRows(null);
    setFileName("");
    setResult(null);
    setResultOk(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const header = columns.map((c) => c.key).join(",");
    const example = columns.map((c) => c.example ?? "").join(",");
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setResultOk(false);
    setBusy(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (res: ParseResult<Record<string, string>>) => {
        const parsed: ParsedRow<T>[] = res.data.map((raw, i) => {
          const v = validateRow(raw, i + 2); // baris 1 = header
          return {
            line: i + 2,
            display: v.key ?? `(tanpa ${keyLabel})`,
            data: v.data,
            key: v.key,
            errors: [...v.errors],
          };
        });

        // Duplikat di dalam file
        const seen = new Map<string, number>();
        for (const r of parsed) {
          if (!r.key) continue;
          const prev = seen.get(r.key);
          if (prev) r.errors.push(`${keyLabel} duplikat di file (baris ${prev})`);
          else seen.set(r.key, r.line);
        }

        // Duplikat di database
        const keys = Array.from(
          new Set(parsed.filter((r) => r.key && r.errors.length === 0).map((r) => r.key as string)),
        );
        if (keys.length) {
          try {
            const existing = new Set(await checkExisting(keys));
            for (const r of parsed) {
              if (r.key && existing.has(r.key)) {
                r.errors.push(`${keyLabel} sudah ada di database`);
              }
            }
          } catch {
            // biarkan; commit akan tetap menolak duplikat lewat constraint DB
          }
        }

        setRows(parsed);
        setBusy(false);
      },
      error: () => {
        setResult("Gagal membaca file CSV.");
        setBusy(false);
      },
    });
  }

  const valid = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? [];
  const preview = rows?.slice(0, 100) ?? [];

  async function onCommit() {
    if (!valid.length) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await commit(valid.map((r) => r.data));
      if (!res.ok) {
        setResult(res.error ?? "Gagal mengimpor.");
        setResultOk(false);
        return;
      }
      setResult(`Berhasil mengimpor ${res.inserted} baris.`);
      setResultOk(true);
      setRows(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload data-icon="inline-start" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <FileDown data-icon="inline-start" />
              Unduh Template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {fileName && (
            <p className="text-xs text-muted-foreground">Berkas: {fileName}</p>
          )}

          {rows && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="positive">
                  <CheckCircle2 />
                  {valid.length} valid
                </Badge>
                {invalid.length > 0 && (
                  <Badge variant="negative">
                    <AlertCircle />
                    {invalid.length} bermasalah
                  </Badge>
                )}
              </div>

              <div className="max-h-72 overflow-auto rounded-card border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16">Baris</TableHead>
                      <TableHead>{keyLabel}</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.line}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.display}
                        </TableCell>
                        <TableCell>
                          {r.errors.length === 0 ? (
                            <Badge variant="positive">Valid</Badge>
                          ) : (
                            <span className="text-xs text-destructive">
                              {r.errors.join(", ")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > preview.length && (
                <p className="text-xs text-muted-foreground">
                  Menampilkan {preview.length} dari {rows.length} baris.
                </p>
              )}
            </>
          )}

          {result && (
            <p
              className={
                resultOk
                  ? "text-sm font-medium text-positive"
                  : "text-sm text-destructive"
              }
            >
              {result}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Tutup
          </Button>
          <Button onClick={onCommit} disabled={busy || valid.length === 0}>
            {busy ? "Memproses…" : `Import ${valid.length} baris`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
