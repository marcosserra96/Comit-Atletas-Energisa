/**
 * Extrato de pontos: filtros, agrupamento por lançamento, totais, regras de
 * edição e planilha. Tudo puro (sem Firebase) para testar à parte.
 */
import type { HistoricoPontoDoc, RegraPontuacaoDoc, TipoLancamento } from "@/lib/types";

// ---------- datas ----------

function paraData(valor: unknown): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === "object" && valor && "toDate" in valor) return (valor as { toDate: () => Date }).toDate();
  if (typeof valor === "object" && valor && "seconds" in valor) return new Date(Number((valor as { seconds: number }).seconds) * 1000);
  if (typeof valor === "string" || typeof valor === "number") {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function milisDoRegistro(l: Pick<HistoricoPontoDoc, "criadoEm">) {
  return paraData(l.criadoEm)?.getTime() ?? 0;
}

/** Dia (YYYY-MM-DD, horário do aparelho) em que o lançamento foi registrado. */
export function diaDoRegistro(l: Pick<HistoricoPontoDoc, "criadoEm">) {
  const d = paraData(l.criadoEm);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "30/07" no ano corrente; "30/07/25" em outros anos. */
export function dataCurta(iso: string, anoAtual = String(new Date().getFullYear())) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const base = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return iso.slice(0, 4) === anoAtual ? base : `${base}/${iso.slice(2, 4)}`;
}

/** "hoje 17:56", "ontem 09:10" ou "28/09 14:02". */
export function momentoDoRegistro(l: Pick<HistoricoPontoDoc, "criadoEm">, agora = new Date()) {
  const d = paraData(l.criadoEm);
  if (!d) return "agora há pouco";
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dia = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const ontem = new Date(agora.getTime() - 24 * 60 * 60_000);
  if (dia(d) === dia(agora)) return `hoje ${hora}`;
  if (dia(d) === dia(ontem)) return `ontem ${hora}`;
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${dataCurta(iso, String(agora.getFullYear()))} ${hora}`;
}

// ---------- filtros ----------

export type CampoData = "treino" | "registro";
export type Situacao = "todos" | "validos" | "estornados";
export type EquipeFiltro = "todas" | "corrida" | "bicicleta";

export interface FiltroExtrato {
  busca: string;
  de: string;
  ate: string;
  campoData: CampoData;
  regraId: string;
  situacao: Situacao;
  equipe: EquipeFiltro;
  pessoa: string;
}

export const FILTRO_VAZIO: FiltroExtrato = {
  busca: "",
  de: "",
  ate: "",
  campoData: "treino",
  regraId: "",
  situacao: "todos",
  equipe: "todas",
  pessoa: "",
};

export function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Quantos filtros além da busca estão ligados (para o botão "Filtros (2)" no celular). */
export function filtrosAtivos(f: FiltroExtrato) {
  return [f.de || f.ate, f.regraId, f.situacao !== "todos", f.equipe !== "todas", f.pessoa].filter(Boolean).length;
}

const equipeBase = (equipe: string) => (equipe.includes("bicicleta") ? "bicicleta" : equipe.includes("corrida") ? "corrida" : equipe);

export function filtrarLancamentos(lancamentos: readonly HistoricoPontoDoc[], f: FiltroExtrato) {
  const termo = normalizarTexto(f.busca);
  return lancamentos.filter((l) => {
    if (termo && !normalizarTexto(l.atletaNome ?? "").includes(termo)) return false;
    if (f.de || f.ate) {
      const dia = f.campoData === "treino" ? l.dataTreino : diaDoRegistro(l);
      if (f.de && dia < f.de) return false;
      if (f.ate && dia > f.ate) return false;
    }
    if (f.regraId && l.regraId !== f.regraId) return false;
    if (f.situacao === "validos" && l.estornado) return false;
    if (f.situacao === "estornados" && !l.estornado) return false;
    if (f.equipe !== "todas" && equipeBase(String(l.equipe)) !== f.equipe) return false;
    if (f.pessoa && l.criadoPor !== f.pessoa) return false;
    return true;
  });
}

// ---------- totais ----------

export function resumoDoExtrato(lancamentos: readonly HistoricoPontoDoc[]) {
  let validos = 0;
  let estornados = 0;
  let km = 0;
  const atletas = new Set<string>();
  const lotes = new Set<string>();
  for (const l of lancamentos) {
    atletas.add(l.atletaId);
    lotes.add(l.loteId || l.id);
    if (l.estornado) estornados += l.pontos;
    else {
      validos += l.pontos;
      km += l.kmPercorrido ?? 0;
    }
  }
  return { lancamentos: lotes.size, registros: lancamentos.length, atletas: atletas.size, pontosValidos: validos, pontosEstornados: estornados, km };
}

// ---------- agrupamento por lançamento ----------

export interface LoteExtrato {
  id: string;
  titulo: string;
  tipo: TipoLancamento;
  /** Datas de treino distintas, em ordem (normalmente uma só). */
  datas: string[];
  criadoPorNome: string;
  criadoEmMs: number;
  itens: HistoricoPontoDoc[];
  atletas: number;
  pontosValidos: number;
  estornados: number;
  editado: boolean;
}

/**
 * Um bloco por lançamento (o "Salvar" do Lançar pontos), do mais recente ao
 * mais antigo: pela data do treino (padrão, combina com os meses da lista) ou
 * pela data em que foi registrado.
 */
export function agruparPorLote(lancamentos: readonly HistoricoPontoDoc[], ordem: CampoData = "treino"): LoteExtrato[] {
  const mapa = new Map<string, HistoricoPontoDoc[]>();
  for (const l of lancamentos) {
    const chave = l.loteId || l.id;
    mapa.set(chave, [...(mapa.get(chave) ?? []), l]);
  }
  const lotes: LoteExtrato[] = [];
  for (const [id, itens] of mapa) {
    const ordenados = [...itens].sort((a, b) => a.atletaNome.localeCompare(b.atletaNome, "pt-BR"));
    const primeiro = ordenados[0];
    const titulo = (primeiro.descricaoLote || "").trim() || primeiro.regraDesc;
    lotes.push({
      id,
      titulo,
      tipo: primeiro.tipoLancamento,
      datas: [...new Set(ordenados.map((l) => l.dataTreino))].sort(),
      criadoPorNome: primeiro.criadoPorNome || "Comitê",
      criadoEmMs: Math.max(...ordenados.map(milisDoRegistro)),
      itens: ordenados,
      atletas: new Set(ordenados.map((l) => l.atletaId)).size,
      pontosValidos: ordenados.filter((l) => !l.estornado).reduce((s, l) => s + l.pontos, 0),
      estornados: ordenados.filter((l) => l.estornado).length,
      editado: ordenados.some((l) => Array.isArray((l as LancamentoComEdicao).edicoes) && (l as LancamentoComEdicao).edicoes!.length > 0),
    });
  }
  return lotes.sort((a, b) =>
    ordem === "treino"
      ? (b.datas[b.datas.length - 1] ?? "").localeCompare(a.datas[a.datas.length - 1] ?? "") || b.criadoEmMs - a.criadoEmMs
      : b.criadoEmMs - a.criadoEmMs,
  );
}

/** "Outubro de 2026" para o cabeçalho dos grupos. */
export function mesDoLote(lote: Pick<LoteExtrato, "criadoEmMs" | "datas">, campo: CampoData) {
  const iso = campo === "treino" ? (lote.datas[lote.datas.length - 1] ?? "") : (() => {
    const d = new Date(lote.criadoEmMs);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  if (!/^\d{4}-\d{2}/.test(iso)) return "Sem data";
  return `${meses[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

// ---------- edição ----------

export interface EdicaoRegistrada {
  em: string;
  porNome: string;
  resumo: string;
  motivo?: string;
}

export type LancamentoComEdicao = HistoricoPontoDoc & {
  edicoes?: EdicaoRegistrada[];
  editadoPorNome?: string;
};

export interface CamposEditaveis {
  criterio: boolean;
  data: boolean;
  km: boolean;
  observacao: boolean;
  /** Por que algum campo está travado (mostrado na janela de edição). */
  aviso?: string;
}

export function camposEditaveis(l: Pick<HistoricoPontoDoc, "estornado" | "regraId" | "tipoLancamento">): CamposEditaveis {
  if (l.estornado) return { criterio: false, data: false, km: false, observacao: false, aviso: "Lançamento estornado não pode ser editado." };
  if (l.regraId === "falta_justificada") {
    return { criterio: false, data: false, km: false, observacao: true, aviso: "Falta justificada: dá para mudar só a observação." };
  }
  if (l.tipoLancamento === "reuniao") {
    return { criterio: false, data: false, km: false, observacao: true, aviso: "Presença em reunião segue a data da reunião: dá para mudar só a observação." };
  }
  return { criterio: true, data: true, km: true, observacao: true };
}

/** Critérios que servem para este lançamento (mesma modalidade e tipo), com o atual sempre na lista. */
export function criteriosParaEdicao(
  regras: readonly RegraPontuacaoDoc[],
  l: Pick<HistoricoPontoDoc, "equipe" | "tipoLancamento" | "regraId" | "regraDesc" | "pontos">,
) {
  const modalidade = equipeBase(String(l.equipe));
  const lista = regras
    .filter((r) => r.id !== "falta_justificada")
    .filter((r) => r.modalidade === "ambas" || r.modalidade === modalidade)
    .filter((r) => r.tiposLancamento.includes(l.tipoLancamento))
    .map((r) => ({ id: r.id, descricao: r.descricao, pontos: r.pontos }));
  if (!lista.some((r) => r.id === l.regraId)) lista.unshift({ id: l.regraId, descricao: l.regraDesc, pontos: l.pontos });
  return lista;
}

export interface MudancasLancamento {
  regraId?: string;
  regraDesc?: string;
  pontos?: number;
  dataTreino?: string;
  kmPercorrido?: number;
  observacao?: string;
}

const kmTexto = (km: number | undefined) => (km ? `${String(Math.round(km * 100) / 100).replace(".", ",")} km` : "sem km");

/** Só o que mudou de verdade, e a frase para o histórico ("Critério: A → B · Data: 01/08 → 02/08"). */
export function resumirMudancas(antes: HistoricoPontoDoc, depois: MudancasLancamento) {
  const mudou: MudancasLancamento = {};
  const partes: string[] = [];
  if (depois.regraId && depois.regraId !== antes.regraId) {
    mudou.regraId = depois.regraId;
    mudou.regraDesc = depois.regraDesc;
    partes.push(`Critério: ${antes.regraDesc} → ${depois.regraDesc}`);
  }
  if (depois.pontos !== undefined && depois.pontos !== antes.pontos) {
    mudou.pontos = depois.pontos;
    partes.push(`Pontos: ${antes.pontos} → ${depois.pontos}`);
  }
  if (depois.dataTreino && depois.dataTreino !== antes.dataTreino) {
    mudou.dataTreino = depois.dataTreino;
    partes.push(`Data: ${dataCurta(antes.dataTreino)} → ${dataCurta(depois.dataTreino)}`);
  }
  if (depois.kmPercorrido !== undefined && (depois.kmPercorrido || 0) !== (antes.kmPercorrido || 0)) {
    mudou.kmPercorrido = depois.kmPercorrido;
    partes.push(`Km: ${kmTexto(antes.kmPercorrido)} → ${kmTexto(depois.kmPercorrido)}`);
  }
  if (depois.observacao !== undefined && depois.observacao.trim() !== (antes.observacao ?? "").trim()) {
    mudou.observacao = depois.observacao.trim();
    partes.push("Observação alterada");
  }
  return { mudou, resumo: partes.join(" · "), vazio: partes.length === 0 };
}

// ---------- planilha ----------

const celula = (v: string | number) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV com ";" (abre direto no Excel em português) e BOM para os acentos. */
export function extratoCsv(lancamentos: readonly HistoricoPontoDoc[]) {
  const cab = ["Data do treino", "Atleta", "Equipe", "Critério", "Lançamento", "Pontos", "Km", "Situação", "Registrado por", "Registrado em", "Observação"];
  const linhas = [...lancamentos]
    .sort((a, b) => b.dataTreino.localeCompare(a.dataTreino) || a.atletaNome.localeCompare(b.atletaNome, "pt-BR"))
    .map((l) => [
      l.dataTreino.split("-").reverse().join("/"),
      l.atletaNome,
      equipeBase(String(l.equipe)) === "bicicleta" ? "Bike" : equipeBase(String(l.equipe)) === "corrida" ? "Corrida" : String(l.equipe),
      l.regraDesc,
      l.descricaoLote ?? "",
      l.pontos,
      l.kmPercorrido ? String(l.kmPercorrido).replace(".", ",") : "",
      l.estornado ? "Estornado" : "Válido",
      l.criadoPorNome ?? "",
      diaDoRegistro(l).split("-").reverse().join("/"),
      (l.observacao ?? "").replace(/\s+/g, " "),
    ]);
  return "﻿" + [cab, ...linhas].map((linha) => linha.map(celula).join(";")).join("\r\n");
}
