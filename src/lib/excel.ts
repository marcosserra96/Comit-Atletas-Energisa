import ExcelJS from "exceljs";

const COR_HEADER = "FF009BC1";
const COR_HEADER_TEXTO = "FFFFFFFF";
const COR_EXEMPLO_BG = "FFF0F4F8";
const COR_EXEMPLO_TEXTO = "FF64748B";
const LINHAS_VALIDACAO = 300;

async function baixarWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function estilizarCabecalho(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COR_HEADER_TEXTO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_HEADER } };
    cell.alignment = { vertical: "middle" };
  });
  header.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function letraColuna(n: number): string {
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(12, h.length + 4),
    }));
    rows.forEach((r) => {
      const row = sheet.addRow(r);
      // Datas em texto ISO (YYYY-MM-DD) viram Date reais com formato brasileiro fixo,
      // pra não depender do locale do Excel de quem abre o arquivo (senão vira m/d/aaaa).
      headers.forEach((h, i) => {
        const valor = r[h];
        if (typeof valor === "string" && ISO_DATE_RE.test(valor)) {
          const cell = row.getCell(i + 1);
          cell.value = new Date(`${valor}T00:00:00`);
          cell.numFmt = "dd/mm/yyyy";
        }
      });
    });
    estilizarCabecalho(sheet);
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    sheet.columns.forEach((col) => {
      let maior = col.header?.toString().length ?? 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const texto = cell.value?.toString() ?? "";
        if (texto.length > maior) maior = texto.length;
      });
      col.width = Math.min(Math.max(maior + 3, 12), 40);
    });
  }
  await baixarWorkbook(workbook, filename);
}

export interface CampoModelo {
  /** Cabeçalho da coluna, exatamente como o usuário vai ver e preencher. */
  coluna: string;
  largura?: number;
  /** Lista de opções válidas — vira um menu suspenso na célula. */
  opcoes?: string[];
  exemplo?: string | number | Date;
  obrigatorio?: boolean;
  /** Explicação de como preencher, exibida na aba "Instruções". */
  descricao: string;
}

export async function baixarModeloImportacao(params: {
  arquivo: string;
  aba: string;
  campos: CampoModelo[];
}) {
  const { arquivo, aba, campos } = params;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(aba);
  sheet.columns = campos.map((c) => ({
    header: c.coluna,
    key: c.coluna,
    width: c.largura ?? Math.max(14, c.coluna.length + 4),
  }));
  estilizarCabecalho(sheet);

  const linhaExemplo = sheet.addRow(
    Object.fromEntries(campos.map((c) => [c.coluna, c.exemplo ?? ""])),
  );
  linhaExemplo.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: COR_EXEMPLO_TEXTO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_EXEMPLO_BG } };
    if (cell.value instanceof Date) cell.numFmt = "dd/mm/yyyy";
  });

  // Listas curtas viram uma fórmula literal; listas longas (ex: nomes de
  // atletas) precisam de uma aba de referência, pois o Excel limita o
  // tamanho de uma lista literal em validação de dados.
  const LIMITE_LISTA_LITERAL = 15;
  let listasSheet: ExcelJS.Worksheet | null = null;

  campos.forEach((c, i) => {
    if (!c.opcoes || c.opcoes.length === 0) return;
    let formula: string;
    if (c.opcoes.length <= LIMITE_LISTA_LITERAL) {
      formula = `"${c.opcoes.join(",")}"`;
    } else {
      if (!listasSheet) {
        listasSheet = workbook.addWorksheet("Listas");
        listasSheet.state = "hidden";
      }
      const colIndice = listasSheet.columnCount + 1;
      const colLetra = letraColuna(colIndice);
      listasSheet.getColumn(colIndice).values = [c.coluna, ...c.opcoes];
      formula = `Listas!$${colLetra}$2:$${colLetra}$${c.opcoes.length + 1}`;
    }
    const col = letraColuna(i + 1);
    for (let linha = 2; linha <= LINHAS_VALIDACAO; linha++) {
      sheet.getCell(`${col}${linha}`).dataValidation = {
        type: "list",
        allowBlank: !c.obrigatorio,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: "Valor inválido",
        error:
          c.opcoes.length <= LIMITE_LISTA_LITERAL
            ? `Escolha um dos valores: ${c.opcoes.join(", ")}`
            : "Escolha um valor da lista suspensa.",
      };
    }
  });

  const instrucoes = workbook.addWorksheet("Instruções");
  instrucoes.columns = [
    { header: "Coluna", key: "coluna", width: 20 },
    { header: "Obrigatório", key: "obrigatorio", width: 14 },
    { header: "Como preencher", key: "descricao", width: 64 },
  ];
  estilizarCabecalho(instrucoes);
  campos.forEach((c) => {
    const opcoesTexto =
      c.opcoes && c.opcoes.length > 0
        ? c.opcoes.length <= LIMITE_LISTA_LITERAL
          ? ` Opções: ${c.opcoes.join(", ")}.`
          : " Use o menu suspenso da célula para escolher um valor válido."
        : "";
    const linha = instrucoes.addRow({
      coluna: c.coluna,
      obrigatorio: c.obrigatorio ? "Sim" : "Não",
      descricao: `${c.descricao}${opcoesTexto}`,
    });
    linha.getCell("descricao").alignment = { wrapText: true, vertical: "top" };
  });

  await baixarWorkbook(workbook, arquivo);
}

/** Converte o valor de uma célula lida para texto — datas viram "AAAA-MM-DD" (hora local, não UTC). */
function celulaParaTexto(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const ano = value.getFullYear();
    const mes = String(value.getMonth() + 1).padStart(2, "0");
    const dia = String(value.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof value === "object") {
    if ("result" in value) return celulaParaTexto(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
  }
  return String(value).trim();
}

export async function readExcelFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const cabecalhos: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumero) => {
    cabecalhos[colNumero] = celulaParaTexto(cell.value).toLowerCase();
  });

  const linhas: Record<string, string>[] = [];
  sheet.eachRow((row, numeroLinha) => {
    if (numeroLinha === 1) return;
    const normalizada: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumero) => {
      const chave = cabecalhos[colNumero];
      if (chave) normalizada[chave] = celulaParaTexto(cell.value);
    });
    linhas.push(normalizada);
  });
  return linhas;
}
