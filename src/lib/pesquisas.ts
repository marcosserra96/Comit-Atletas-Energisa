import type { Equipe, Modalidade } from "@/lib/types";

export type TipoPergunta =
  | "unica"
  | "multipla"
  | "lista"
  | "sim_nao"
  | "escala"
  | "nps"
  | "ordenar"
  | "numero"
  | "data"
  | "texto_curto"
  | "texto_longo";

/** Ordem em que os tipos aparecem para o comitê escolher. */
export const TIPO_PERGUNTA_LABEL: Record<TipoPergunta, string> = {
  unica: "Escolha única",
  multipla: "Múltipla escolha",
  lista: "Lista suspensa",
  sim_nao: "Sim ou não",
  escala: "Nota de 1 a 5",
  nps: "Nota de 0 a 10",
  ordenar: "Ordenar opções",
  numero: "Número",
  data: "Data",
  texto_curto: "Resposta curta",
  texto_longo: "Resposta longa",
};

/** Uma linha para ajudar o comitê a escolher o tipo. */
export const TIPO_PERGUNTA_DICA: Record<TipoPergunta, string> = {
  unica: "O atleta marca uma opção.",
  multipla: "O atleta marca quantas opções quiser.",
  lista: "Uma opção de uma lista longa (ex.: tamanho de camiseta).",
  sim_nao: "Resposta rápida: Sim ou Não.",
  escala: "Satisfação de 1 (ruim) a 5 (ótimo).",
  nps: "De 0 a 10, quanto recomendaria. O resultado mostra o NPS.",
  ordenar: "O atleta coloca as opções em ordem de preferência.",
  numero: "Um valor numérico (ex.: quantos km por semana).",
  data: "Uma data (ex.: melhor dia para o próximo evento).",
  texto_curto: "Uma linha de texto.",
  texto_longo: "Um texto mais longo, com comentários.",
};

export interface PerguntaPesquisa {
  id: string;
  tipo: TipoPergunta;
  enunciado: string;
  /** Escolha única, múltipla, lista e ordenar. */
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

export function temOpcoes(tipo: TipoPergunta) {
  return tipo === "unica" || tipo === "multipla" || tipo === "lista" || tipo === "ordenar";
}

export const OPCOES_SIM_NAO = ["Sim", "Não"];

export function novaPergunta(tipo: TipoPergunta = "unica"): PerguntaPesquisa {
  return {
    id: Math.random().toString(36).slice(2, 10),
    tipo,
    enunciado: "",
    obrigatoria: true,
    ...(temOpcoes(tipo) ? { opcoes: ["", ""] } : {}),
  };
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

/** Número digitado (aceita vírgula). null se não for um número completo. */
export function lerNumero(v: ValorResposta | undefined) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Ids das perguntas obrigatórias sem resposta. */
export function obrigatoriasPendentes(perguntas: PerguntaPesquisa[], respostas: Record<string, ValorResposta>) {
  return perguntas
    .filter((q) => q.obrigatoria && (respostaVazia(respostas[q.id]) || (q.tipo === "numero" && lerNumero(respostas[q.id]) === null)))
    .map((q) => q.id);
}

/** Respostas só das perguntas existentes e no formato certo (texto aparado). */
export function normalizarRespostas(perguntas: PerguntaPesquisa[], respostas: Record<string, ValorResposta>) {
  const limpas: Record<string, ValorResposta> = {};
  for (const q of perguntas) {
    const v = respostas[q.id];
    if (respostaVazia(v)) continue;
    if (q.tipo === "escala" && typeof v === "number") limpas[q.id] = Math.min(5, Math.max(1, Math.round(v)));
    else if (q.tipo === "nps" && typeof v === "number") limpas[q.id] = Math.min(10, Math.max(0, Math.round(v)));
    else if (q.tipo === "numero" && lerNumero(v) !== null) {
      const n = lerNumero(v) as number;
      limpas[q.id] = Math.max(-1e9, Math.min(1e9, Math.round(n * 100) / 100));
    } else if (q.tipo === "multipla" && Array.isArray(v)) limpas[q.id] = v.filter((o) => q.opcoes?.includes(o));
    else if (q.tipo === "ordenar" && Array.isArray(v)) {
      const opcoes = q.opcoes ?? [];
      // Precisa ser uma ordem completa das opções, sem repetir.
      if (v.length === opcoes.length && new Set(v).size === v.length && v.every((o) => opcoes.includes(o))) {
        limpas[q.id] = v;
      }
    } else if ((q.tipo === "unica" || q.tipo === "lista") && typeof v === "string" && q.opcoes?.includes(v)) {
      limpas[q.id] = v;
    } else if (q.tipo === "sim_nao" && typeof v === "string" && OPCOES_SIM_NAO.includes(v)) limpas[q.id] = v;
    else if (q.tipo === "data" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) limpas[q.id] = v;
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

export interface ResultadoNps {
  /** % promotores (9–10) menos % detratores (0–6): de -100 a 100. */
  nps: number;
  promotores: number;
  neutros: number;
  detratores: number;
}

export type ResultadoPergunta =
  | { pergunta: PerguntaPesquisa; tipo: "opcoes"; responderam: number; opcoes: ResultadoOpcao[] }
  | { pergunta: PerguntaPesquisa; tipo: "escala"; responderam: number; media: number | null; distribuicao: ResultadoOpcao[] }
  | {
      pergunta: PerguntaPesquisa;
      tipo: "nps";
      responderam: number;
      media: number | null;
      distribuicao: ResultadoOpcao[];
      nps: ResultadoNps | null;
    }
  | {
      pergunta: PerguntaPesquisa;
      tipo: "ordem";
      responderam: number;
      /** Da mais preferida para a menos: posição média (1 = primeiro lugar). */
      opcoes: { opcao: string; posicaoMedia: number; primeiroLugar: number }[];
    }
  | {
      pergunta: PerguntaPesquisa;
      tipo: "numero";
      responderam: number;
      media: number | null;
      minimo: number | null;
      maximo: number | null;
      valores: { atletaNome: string; valor: number }[];
    }
  | { pergunta: PerguntaPesquisa; tipo: "texto"; responderam: number; textos: { atletaNome: string; texto: string }[] };

function media(numeros: number[]) {
  return numeros.length ? Math.round((numeros.reduce((s, n) => s + n, 0) / numeros.length) * 10) / 10 : null;
}

/** "2026-10-05" → "05/10/2026" */
export function formatarDataSimples(valor: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

export function resultadosDaPesquisa(perguntas: PerguntaPesquisa[], respostas: RespostaPesquisaDoc[]): ResultadoPergunta[] {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  return perguntas.map((q) => {
    const valores = respostas
      .map((r) => ({ nome: r.atletaNome, v: r.respostas?.[q.id] }))
      .filter((x) => !respostaVazia(x.v));
    const responderam = valores.length;
    if (q.tipo === "ordenar") {
      const opcoes = q.opcoes ?? [];
      const ordens = valores.map((x) => x.v).filter((v): v is string[] => Array.isArray(v));
      return {
        pergunta: q,
        tipo: "ordem",
        responderam,
        opcoes: opcoes
          .map((opcao) => {
            const posicoes = ordens.map((o) => o.indexOf(opcao) + 1).filter((n) => n > 0);
            return {
              opcao,
              posicaoMedia: media(posicoes) ?? 0,
              primeiroLugar: ordens.filter((o) => o[0] === opcao).length,
            };
          })
          .sort((a, b) => a.posicaoMedia - b.posicaoMedia || b.primeiroLugar - a.primeiroLugar),
      };
    }
    if (temOpcoes(q.tipo) || q.tipo === "sim_nao" || q.tipo === "data") {
      const base =
        q.tipo === "sim_nao"
          ? OPCOES_SIM_NAO
          : q.tipo === "data"
            ? [...new Set(valores.map((x) => String(x.v)))].sort()
            : (q.opcoes ?? []);
      const contagem = new Map(base.map((o) => [o, 0]));
      for (const { v } of valores) {
        for (const o of Array.isArray(v) ? v : [v as string]) {
          if (contagem.has(o)) contagem.set(o, (contagem.get(o) ?? 0) + 1);
        }
      }
      return {
        pergunta: q,
        tipo: "opcoes",
        responderam,
        opcoes: [...contagem].map(([opcao, total]) => ({
          opcao: q.tipo === "data" ? formatarDataSimples(opcao) : opcao,
          total,
          percentual: pct(total, responderam),
        })),
      };
    }
    if (q.tipo === "nps") {
      const notas = valores.map((x) => Number(x.v)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 10);
      const promotores = notas.filter((n) => n >= 9).length;
      const detratores = notas.filter((n) => n <= 6).length;
      return {
        pergunta: q,
        tipo: "nps",
        responderam,
        media: media(notas),
        distribuicao: Array.from({ length: 11 }, (_, n) => {
          const total = notas.filter((x) => x === n).length;
          return { opcao: String(n), total, percentual: pct(total, notas.length) };
        }),
        nps: notas.length
          ? {
              nps: pct(promotores, notas.length) - pct(detratores, notas.length),
              promotores: pct(promotores, notas.length),
              neutros: pct(notas.length - promotores - detratores, notas.length),
              detratores: pct(detratores, notas.length),
            }
          : null,
      };
    }
    if (q.tipo === "numero") {
      const lista = valores
        .map((x) => ({ atletaNome: x.nome, valor: Number(x.v) }))
        .filter((x) => Number.isFinite(x.valor))
        .sort((a, b) => b.valor - a.valor);
      const nums = lista.map((x) => x.valor);
      return {
        pergunta: q,
        tipo: "numero",
        responderam,
        media: media(nums),
        minimo: nums.length ? Math.min(...nums) : null,
        maximo: nums.length ? Math.max(...nums) : null,
        valores: lista,
      };
    }
    if (q.tipo === "escala") {
      const notas = valores.map((x) => Number(x.v)).filter((n) => n >= 1 && n <= 5);
      return {
        pergunta: q,
        tipo: "escala",
        responderam,
        media: media(notas),
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
      linha[`${i + 1}. ${q.enunciado}`] = respostaVazia(v)
        ? ""
        : Array.isArray(v)
          ? v.join(q.tipo === "ordenar" ? " > " : "; ")
          : q.tipo === "data" && typeof v === "string"
            ? formatarDataSimples(v)
            : v;
    });
    return linha;
  });
}

/** "05/10 às 18:00" */
export function formatarDataHora(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      // Mesmo horário no servidor (texto das notificações) e no celular.
      timeZone: "America/Sao_Paulo",
    }).replace(", ", " às ");
}
