import type { Equipe, Modalidade } from "@/lib/types";

export type TipoPergunta = "unica" | "multipla" | "escala" | "texto_curto" | "texto_longo";

export const TIPO_PERGUNTA_LABEL: Record<TipoPergunta, string> = {
  unica: "Escolha única",
  multipla: "Múltipla escolha",
  escala: "Nota de 1 a 5",
  texto_curto: "Resposta curta",
  texto_longo: "Resposta longa",
};

export interface PerguntaPesquisa {
  id: string;
  tipo: TipoPergunta;
  enunciado: string;
  /** Só em escolha única e múltipla. */
  opcoes?: string[];
  obrigatoria: boolean;
}

export type PublicoPesquisa = "todos" | Modalidade;

/** Documento `pesquisas/{id}`. Datas em ISO (UTC); o portal mostra no horário local. */
export interface PesquisaDoc {
  id: string;
  titulo: string;
  descricao: string;
  perguntas: PerguntaPesquisa[];
  publico: PublicoPesquisa;
  abreEm: string;
  fechaEm: string;
  /** Mesmas datas como Timestamp, para as regras do Firestore validarem o período. */
  abreEmTs?: unknown;
  fechaEmTs?: unknown;
  /** Rascunho não aparece para os atletas. */
  publicada: boolean;
  criadoEm?: unknown;
  criadoPor?: string;
  criadoPorNome?: string;
  atualizadoEm?: unknown;
}

export type ValorResposta = string | string[] | number;

/** Documento `pesquisas/{id}/respostas/{atletaId}` (respostas identificadas). */
export interface RespostaPesquisaDoc {
  atletaId: string;
  atletaNome: string;
  equipe: Equipe;
  respostas: Record<string, ValorResposta>;
  respondidoEm?: unknown;
}

export type SituacaoPesquisa = "rascunho" | "agendada" | "aberta" | "encerrada";

export const SITUACAO_LABEL: Record<SituacaoPesquisa, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  aberta: "Aberta",
  encerrada: "Encerrada",
};

export function situacaoPesquisa(p: Pick<PesquisaDoc, "publicada" | "abreEm" | "fechaEm">, agora = new Date()) {
  if (!p.publicada) return "rascunho" as const;
  const t = agora.getTime();
  if (t < Date.parse(p.abreEm)) return "agendada" as const;
  if (t >= Date.parse(p.fechaEm)) return "encerrada" as const;
  return "aberta" as const;
}

/** A pesquisa vale para o atleta desta equipe (fila de espera fica de fora). */
export function pesquisaParaEquipe(p: Pick<PesquisaDoc, "publico">, equipe: Equipe | string | undefined) {
  if (equipe !== "corrida" && equipe !== "bicicleta") return false;
  return p.publico === "todos" || p.publico === equipe;
}

export function novaPergunta(tipo: TipoPergunta = "unica"): PerguntaPesquisa {
  return {
    id: Math.random().toString(36).slice(2, 10),
    tipo,
    enunciado: "",
    obrigatoria: true,
    ...(tipo === "unica" || tipo === "multipla" ? { opcoes: ["", ""] } : {}),
  };
}

export function temOpcoes(tipo: TipoPergunta) {
  return tipo === "unica" || tipo === "multipla";
}

/** Problemas que impedem publicar; vazio = pronta. */
export function problemasDaPesquisa(p: Pick<PesquisaDoc, "titulo" | "perguntas" | "abreEm" | "fechaEm">) {
  const problemas: string[] = [];
  if (!p.titulo.trim()) problemas.push("Dê um título à pesquisa.");
  if (p.perguntas.length === 0) problemas.push("Inclua ao menos uma pergunta.");
  p.perguntas.forEach((q, i) => {
    if (!q.enunciado.trim()) problemas.push(`Pergunta ${i + 1}: escreva o enunciado.`);
    if (temOpcoes(q.tipo)) {
      const opcoes = (q.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
      if (opcoes.length < 2) problemas.push(`Pergunta ${i + 1}: inclua ao menos duas opções.`);
      if (new Set(opcoes.map((o) => o.toLowerCase())).size !== opcoes.length) {
        problemas.push(`Pergunta ${i + 1}: há opções repetidas.`);
      }
    }
  });
  if (!p.abreEm || !p.fechaEm) problemas.push("Defina quando a pesquisa abre e fecha.");
  else if (Date.parse(p.fechaEm) <= Date.parse(p.abreEm)) problemas.push("O fechamento precisa ser depois da abertura.");
  return problemas;
}

/** Remove opções vazias antes de salvar. */
export function limparPerguntas(perguntas: PerguntaPesquisa[]): PerguntaPesquisa[] {
  return perguntas.map((q) => {
    const base = { id: q.id, tipo: q.tipo, enunciado: q.enunciado.trim(), obrigatoria: q.obrigatoria };
    return temOpcoes(q.tipo)
      ? { ...base, opcoes: (q.opcoes ?? []).map((o) => o.trim()).filter(Boolean) }
      : base;
  });
}

export function respostaVazia(valor: ValorResposta | undefined) {
  if (valor === undefined || valor === null) return true;
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "string") return valor.trim() === "";
  return false;
}

/** Ids das perguntas obrigatórias sem resposta. */
export function obrigatoriasPendentes(perguntas: PerguntaPesquisa[], respostas: Record<string, ValorResposta>) {
  return perguntas.filter((q) => q.obrigatoria && respostaVazia(respostas[q.id])).map((q) => q.id);
}

/** Respostas só das perguntas existentes e no formato certo (texto aparado). */
export function normalizarRespostas(perguntas: PerguntaPesquisa[], respostas: Record<string, ValorResposta>) {
  const limpas: Record<string, ValorResposta> = {};
  for (const q of perguntas) {
    const v = respostas[q.id];
    if (respostaVazia(v)) continue;
    if (q.tipo === "escala" && typeof v === "number") limpas[q.id] = Math.min(5, Math.max(1, Math.round(v)));
    else if (q.tipo === "multipla" && Array.isArray(v)) limpas[q.id] = v.filter((o) => q.opcoes?.includes(o));
    else if (q.tipo === "unica" && typeof v === "string" && q.opcoes?.includes(v)) limpas[q.id] = v;
    else if ((q.tipo === "texto_curto" || q.tipo === "texto_longo") && typeof v === "string") {
      limpas[q.id] = v.trim().slice(0, q.tipo === "texto_curto" ? 200 : 2000);
    }
  }
  return limpas;
}

export interface ResultadoOpcao {
  opcao: string;
  total: number;
  /** 0–100 sobre quem respondeu a pergunta. */
  percentual: number;
}

export type ResultadoPergunta =
  | { pergunta: PerguntaPesquisa; tipo: "opcoes"; responderam: number; opcoes: ResultadoOpcao[] }
  | { pergunta: PerguntaPesquisa; tipo: "escala"; responderam: number; media: number | null; distribuicao: ResultadoOpcao[] }
  | { pergunta: PerguntaPesquisa; tipo: "texto"; responderam: number; textos: { atletaNome: string; texto: string }[] };

export function resultadosDaPesquisa(perguntas: PerguntaPesquisa[], respostas: RespostaPesquisaDoc[]): ResultadoPergunta[] {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  return perguntas.map((q) => {
    const valores = respostas
      .map((r) => ({ nome: r.atletaNome, v: r.respostas?.[q.id] }))
      .filter((x) => !respostaVazia(x.v));
    const responderam = valores.length;
    if (temOpcoes(q.tipo)) {
      const contagem = new Map((q.opcoes ?? []).map((o) => [o, 0]));
      for (const { v } of valores) {
        for (const o of Array.isArray(v) ? v : [v as string]) {
          if (contagem.has(o)) contagem.set(o, (contagem.get(o) ?? 0) + 1);
        }
      }
      return {
        pergunta: q,
        tipo: "opcoes",
        responderam,
        opcoes: [...contagem].map(([opcao, total]) => ({ opcao, total, percentual: pct(total, responderam) })),
      };
    }
    if (q.tipo === "escala") {
      const notas = valores.map((x) => Number(x.v)).filter((n) => n >= 1 && n <= 5);
      return {
        pergunta: q,
        tipo: "escala",
        responderam,
        media: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
        distribuicao: [5, 4, 3, 2, 1].map((n) => {
          const total = notas.filter((x) => x === n).length;
          return { opcao: String(n), total, percentual: pct(total, notas.length) };
        }),
      };
    }
    return {
      pergunta: q,
      tipo: "texto",
      responderam,
      textos: valores.map((x) => ({ atletaNome: x.nome, texto: String(x.v) })),
    };
  });
}

/** Linhas da planilha: uma por atleta, uma coluna por pergunta. */
export function linhasExportacao(
  perguntas: PerguntaPesquisa[],
  respostas: RespostaPesquisaDoc[],
  formatarData: (valor: unknown) => string,
) {
  return respostas.map((r) => {
    const linha: Record<string, unknown> = {
      Atleta: r.atletaNome,
      Modalidade: r.equipe === "bicicleta" ? "Bike" : r.equipe === "corrida" ? "Corrida" : r.equipe,
      "Respondido em": formatarData(r.respondidoEm),
    };
    perguntas.forEach((q, i) => {
      const v = r.respostas?.[q.id];
      linha[`${i + 1}. ${q.enunciado}`] = respostaVazia(v) ? "" : Array.isArray(v) ? v.join("; ") : v;
    });
    return linha;
  });
}

/** "2026-10-05T18:00" (datetime-local) ↔ ISO, sempre no fuso do navegador. */
export function isoParaCampoLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function campoLocalParaIso(valor: string) {
  return valor ? new Date(valor).toISOString() : "";
}

/** "05/10 às 18:00" */
export function formatarDataHora(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(", ", " às ");
}
