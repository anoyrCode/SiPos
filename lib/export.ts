// `xlsx` dimuat dinamis (bukan import statis) — dipanggil dari komponen client,
// jadi tanpa ini library-nya ikut ke-bundle ke JS halaman walau user gak pernah
// klik tombol Excel. Sama pola dgn `jsPDF` di `lib/pdf.ts`.

export async function downloadExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  colWidths?: number[],
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths?.length) {
    ws["!cols"] = colWidths.map((wch) => ({ wch }));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export async function downloadExcelMultiSheet(
  filename: string,
  sheets: {
    sheetName: string;
    rows: Record<string, unknown>[];
    colWidths?: number[];
    /**
     * Baris keterangan di atas tabel (tiap elemen = satu baris, tiap
     * sub-elemen = satu sel). Kalau diisi, tabel `rows` ditulis di bawahnya
     * lengkap dengan header kolomnya.
     */
    infoRows?: (string | number)[][];
  }[],
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    let ws;
    if (sheet.infoRows?.length) {
      ws = XLSX.utils.aoa_to_sheet(sheet.infoRows);
      // `origin: -1` menaruh tabel mulai baris setelah isi terakhir, dan
      // tetap menulis header kolom (skipHeader default false).
      XLSX.utils.sheet_add_json(ws, sheet.rows, { origin: -1 });
    } else {
      ws = XLSX.utils.json_to_sheet(sheet.rows);
    }
    if (sheet.colWidths?.length) {
      ws["!cols"] = sheet.colWidths.map((wch) => ({ wch }));
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  }
  XLSX.writeFile(wb, filename);
}
