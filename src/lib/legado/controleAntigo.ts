import ExcelJS from "exceljs";

const MESES: Record<string, string> = {
  jan: "01",
  janeiro: "01",
  fev: "02",
  fevereiro: "02",
  mar: "03",
  março: "03",
  marco: "03",
  abr: "04",
  abril: "04",
  mai: "05",
  maio: "05",
  jun: "06",
  junho: "06",
  jul: "07",
  julho: "07",
  ago: "08",
  agosto: "08",
  set: "09",
  setembro: "09",
  out: "10",
  outubro: "10",
  nov: "11",
  novembro: "11",
  dez: "12",
  dezembro: "12",
};

export interface AbaDetectada {
  nome: string;
  equipeLabel: string;
  mesLabel: string;
  mesNumero: string | null;
}

export interface EntradaBruta {
  atletaNomeBruto: string;
  dia: number;
  diaSemana: string;
  pontos: number;
}

export interface ComboPendente {
  chave: string;
  diaSemana: string;
  pontos: number;
  quantidade: number;
}

export async function carregarWorkbook(file: File): Promise<ExcelJS.Workbook> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/** Lista as abas que parecem grades de controle (ignora abas de impressão/relatório). */
export function listarAbas(workbook: ExcelJS.Workbook): AbaDetectada[] {
  return workbook.worksheets
    .filter((s) => !s.name.toLowerCase().startsWith("imprimir"))
    .map((s) => {
      const [equipeLabel = "", mesLabel = ""] = s.name.split(" ");
      return {
        nome: s.name,
        equipeLabel,
        mesLabel,
        mesNumero: MESES[mesLabel.trim().toLowerCase()] ?? null,
      };
    });
}

function textoDeCelula(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return String(v);
}

/**
 * Extrai as marcações de presença/pontos de uma aba no formato grade semanal
 * (uma linha por atleta, pares de colunas [dia-do-mês, "PTN"] por dia da semana).
 */
export function parsearAba(workbook: ExcelJS.Workbook, nomeAba: string): EntradaBruta[] {
  const sheet = workbook.getWorksheet(nomeAba);
  if (!sheet) return [];

  // A linha com os rótulos "PTN" varia um pouco de aba pra aba — procura a primeira
  // linha nas primeiras 10 que tenha ao menos uma célula "PTN".
  let linhaCabecalho = -1;
  for (let r = 1; r <= 10; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= sheet.columnCount; c++) {
      if (textoDeCelula(row.getCell(c).value).trim() === "PTN") {
        linhaCabecalho = r;
        break;
      }
    }
    if (linhaCabecalho > 0) break;
  }
  if (linhaCabecalho < 0) return [];

  const headerRow = sheet.getRow(linhaCabecalho);
  const diaSemanaRow = sheet.getRow(linhaCabecalho - 1);
  const paresDia: { colPtn: number; dia: number; diaSemana: string }[] = [];
  for (let c = 1; c <= sheet.columnCount; c++) {
    if (textoDeCelula(headerRow.getCell(c).value).trim() !== "PTN") continue;
    const dia = headerRow.getCell(c - 1).value;
    if (typeof dia !== "number") continue;
    const diaSemana = textoDeCelula(diaSemanaRow.getCell(c - 1).value).trim() || `col${c}`;
    paresDia.push({ colPtn: c, dia, diaSemana });
  }
  if (paresDia.length === 0) return [];

  // Nome do atleta fica sempre na mesma coluna do cabeçalho ("Atletas Energisa - ...").
  let colNome = 4;
  for (let c = 1; c <= sheet.columnCount; c++) {
    const v = textoDeCelula(headerRow.getCell(c).value);
    if (v.toLowerCase().startsWith("atletas energisa")) {
      colNome = c;
      break;
    }
  }

  const entradas: EntradaBruta[] = [];
  for (let r = linhaCabecalho + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    let nome = textoDeCelula(row.getCell(colNome).value).trim();
    if (nome.toLowerCase() === "justificativas") break;
    if (!nome) continue;
    nome = nome.replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (!nome) continue;

    for (const { colPtn, dia, diaSemana } of paresDia) {
      const pontos = row.getCell(colPtn).value;
      if (typeof pontos === "number" && pontos > 0) {
        entradas.push({ atletaNomeBruto: nome, dia, diaSemana, pontos });
      }
    }
  }
  return entradas;
}

/** Agrupa as entradas por (dia da semana + pontos), pra montar a tela de vínculo com regras. */
export function agruparCombos(entradas: EntradaBruta[]): ComboPendente[] {
  const mapa = new Map<string, ComboPendente>();
  for (const e of entradas) {
    const chave = `${e.diaSemana}|${e.pontos}`;
    const atual = mapa.get(chave) ?? { chave, diaSemana: e.diaSemana, pontos: e.pontos, quantidade: 0 };
    atual.quantidade += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => a.diaSemana.localeCompare(b.diaSemana) || a.pontos - b.pontos);
}
