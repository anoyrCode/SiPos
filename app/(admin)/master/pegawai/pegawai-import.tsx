"use client";

import { CsvImport, type CsvColumn, type RowValidation } from "@/components/shared/csv-import";
import { checkExistingNip, importPegawai } from "./actions";
import type { PegawaiInput } from "./schema";

const columns: CsvColumn[] = [
  { key: "nip", label: "NIP", example: "198765432100" },
  { key: "nama", label: "Nama", example: "Ustadz Hasan" },
  { key: "email", label: "Email", example: "hasan@contoh.com" },
  { key: "jabatan", label: "Jabatan", example: "Guru" },
  { key: "jenis_kelamin", label: "Jenis Kelamin", example: "L" },
  { key: "telp", label: "Telepon", example: "081234567890" },
  { key: "tempat_lahir", label: "Tempat Lahir", example: "Surabaya" },
  { key: "tanggal_lahir", label: "Tanggal Lahir", example: "1987-05-20" },
  { key: "alamat", label: "Alamat", example: "Jl. Pesantren No. 1" },
];

function validateRow(raw: Record<string, string>): RowValidation<PegawaiInput> {
  const get = (k: string) => (raw[k] ?? "").trim();
  const errors: string[] = [];

  const nip = get("nip");
  const nama = get("nama");
  if (!nama) errors.push("Nama wajib diisi");
  if (!nip) errors.push("NIP wajib diisi");

  let jenis_kelamin: "L" | "P" | undefined;
  const jk = get("jenis_kelamin").toUpperCase();
  if (jk) {
    if (jk === "L" || jk === "P") jenis_kelamin = jk;
    else errors.push("Jenis kelamin harus L/P");
  }

  const email = get("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email tidak valid");
  }

  const tanggal_lahir = get("tanggal_lahir");
  if (tanggal_lahir && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_lahir)) {
    errors.push("Tanggal lahir harus format YYYY-MM-DD");
  }

  const data: PegawaiInput = {
    nip,
    nama,
    email,
    jabatan: get("jabatan"),
    jenis_kelamin,
    telp: get("telp"),
    tempat_lahir: get("tempat_lahir"),
    tanggal_lahir,
    alamat: get("alamat"),
  };

  return { data, key: nip || null, errors };
}

export function PegawaiImport() {
  return (
    <CsvImport<PegawaiInput>
      title="Import Pegawai (CSV)"
      description="Unduh template, isi, lalu unggah. Baris dengan NIP duplikat atau tidak valid otomatis dilewati."
      columns={columns}
      keyLabel="NIP"
      validateRow={validateRow}
      checkExisting={checkExistingNip}
      commit={importPegawai}
      templateFilename="template-pegawai.csv"
    />
  );
}
