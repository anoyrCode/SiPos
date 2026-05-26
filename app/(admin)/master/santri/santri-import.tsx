"use client";

import { CsvImport, type CsvColumn, type RowValidation } from "@/components/shared/csv-import";
import { checkExistingNis, importSantri } from "./actions";
import type { SantriInput } from "./schema";

const columns: CsvColumn[] = [
  { key: "nis", label: "NIS", example: "2026001" },
  { key: "nisn", label: "NISN", example: "0012345678" },
  { key: "nama", label: "Nama", example: "Ahmad Fauzan" },
  { key: "jenis_kelamin", label: "Jenis Kelamin", example: "L" },
  { key: "email", label: "Email", example: "ahmad@contoh.com" },
  { key: "nama_ayah", label: "Nama Ayah", example: "Bapak Ahmad" },
  { key: "nama_ibu", label: "Nama Ibu", example: "Ibu Ahmad" },
  { key: "nama_wali", label: "Nama Wali", example: "Bapak Ahmad" },
  { key: "no_telp_wali", label: "No Telp Wali", example: "081234567890" },
  { key: "status", label: "Status", example: "aktif" },
];

function validateRow(raw: Record<string, string>): RowValidation<SantriInput> {
  const get = (k: string) => (raw[k] ?? "").trim();
  const errors: string[] = [];

  const nis = get("nis");
  const nama = get("nama");
  if (!nama) errors.push("Nama wajib diisi");
  if (!nis) errors.push("NIS wajib diisi");

  let jenis_kelamin: "L" | "P" | undefined;
  const jk = get("jenis_kelamin").toUpperCase();
  if (jk) {
    if (jk === "L" || jk === "P") jenis_kelamin = jk;
    else errors.push("Jenis kelamin harus L/P");
  }

  let status: SantriInput["status"] = "aktif";
  const s = get("status").toLowerCase();
  if (s) {
    if (s === "aktif" || s === "lulus" || s === "keluar") status = s;
    else errors.push("Status harus aktif/lulus/keluar");
  }

  const email = get("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email tidak valid");
  }

  const data: SantriInput = {
    nis,
    nisn: get("nisn"),
    nama,
    email,
    jenis_kelamin,
    nama_ayah: get("nama_ayah"),
    nama_ibu: get("nama_ibu"),
    nama_wali: get("nama_wali"),
    no_telp_wali: get("no_telp_wali"),
    status,
  };

  return { data, key: nis || null, errors };
}

export function SantriImport() {
  return (
    <CsvImport<SantriInput>
      title="Import Santri (CSV)"
      description="Unduh template, isi, lalu unggah. Baris dengan NIS duplikat atau tidak valid otomatis dilewati."
      columns={columns}
      keyLabel="NIS"
      validateRow={validateRow}
      checkExisting={checkExistingNis}
      commit={importSantri}
      templateFilename="template-santri.csv"
    />
  );
}
