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
