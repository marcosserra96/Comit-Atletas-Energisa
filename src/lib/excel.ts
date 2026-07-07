import * as XLSX from "xlsx";

export function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function downloadTemplate(
  filename: string,
  sheetName: string,
  headers: string[],
  sampleRow?: Record<string, unknown>,
) {
  const row = sampleRow ?? Object.fromEntries(headers.map((h) => [h, ""]));
  exportToExcel(filename, sheetName, [row]);
}

/** Converte um valor de célula para texto — datas viram "AAAA-MM-DD" (hora local, não UTC). */
function celulaParaTexto(value: unknown): string {
  if (value instanceof Date) {
    const ano = value.getFullYear();
    const mes = String(value.getMonth() + 1).padStart(2, "0");
    const dia = String(value.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  return String(value ?? "").trim();
}

export async function readExcelFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  // cellDates: true faz células de data virarem Date (em vez do número serial do Excel),
  // que celulaParaTexto converte para "AAAA-MM-DD" — sem isso, uma data digitada
  // normalmente no Excel/Sheets chega como texto tipo "35925" e quebra a formatação.
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = celulaParaTexto(value);
    }
    return normalized;
  });
}
