import * as XLSX from "xlsx";

export function downloadExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  colWidths?: number[],
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths?.length) {
    ws["!cols"] = colWidths.map((wch) => ({ wch }));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function downloadExcelMultiSheet(
  filename: string,
  sheets: {
    sheetName: string;
    rows: Record<string, unknown>[];
    colWidths?: number[];
  }[],
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    if (sheet.colWidths?.length) {
      ws["!cols"] = sheet.colWidths.map((wch) => ({ wch }));
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  }
  XLSX.writeFile(wb, filename);
}
