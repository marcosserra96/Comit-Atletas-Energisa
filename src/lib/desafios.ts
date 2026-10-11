/**
 * Desafios do comitê: medalhas temporárias com nome, período e uma meta
 * escolhida de uma lista curta. Tudo puro (sem Firebase): roda no celular do
 * atleta, na gestão e no servidor (para avisar quem completou).
 */
import { consolidarAtividades, type RegrasDeTreino } from "@/lib/activityConsolidation";
import { diaQueAlcancou, segundaDaSemana, type IconeMedalha, type MedalhaDoAtleta, type NivelMedalha } from "@/lib/conquistas";
import type { HistoricoPontoDoc, Modalidade } from "@/lib/types";

export type TipoDesafio = "treinos" | "km" | "semanas" | "provas";
export type ModalidadeDesafio = "todas" | Modalidade;

export interface DesafioDoc {
  id: string;
  titulo: string;
  modalidade: ModalidadeDesafio;
  tipo: TipoDesafio;
  /** Meta de cada modalidade que participa (km costuma ser diferente entre Corrida e Bike). */
  metas: Partial<Record<Modalidade, number>>;
  inicio: string;
  fim: string;
  icone: IconeMedalha;
  nivel: NivelMedalha;
  atualizadoPorNome?: string | null;
}

export const TIPO_DESAFIO: Record<TipoDesafio, { rotulo: string; ajuda: string; singular: string; plural: string }> = {
  treinos: { rotulo: "Treinos", ajuda: "Quantidade de treinos no período.", singular: "treino", plural: "treinos" },
  km: { rotulo: "Quilômetros", ajuda: "Soma dos km de treinos e provas no período.", singular: "km", plural: "km" },
  semanas: { rotulo: "Semanas com treino", ajuda: "Semanas diferentes com pelo menos um treino.", singular: "semana", plural: "semanas" },
  provas: { rotulo: "Provas", ajuda: "Provas oficiais do programa no período.", singular: "prova", plural: "provas" },
};

/** Ícones que o comitê pode escolher, na ordem do seletor. */
export const ICONES_DESAFIO: { id: IconeMedalha; rotulo: string }[] = [
  { id: "bandeira", rotulo: "Bandeira" },
  { id: "estrela", rotulo: "Estrela" },
  { id: "coracao", rotulo: "Coração" },
  { id: "montanha", rotulo: "Montanha" },
  { id: "chama", rotulo: "Chama" },
  { id: "km", rotulo: "Percurso" },
  { id: "treino", rotulo: "Passos" },
  { id: "prova", rotulo: "Medalha" },
];

export const NIVEIS_DESAFIO: { nivel: NivelMedalha; rotulo: string }[] = [
  { nivel: 1, rotulo: "Bronze" },
  { nivel: 2, rotulo: "Prata" },
  { nivel: 3, rotulo: "Ouro" },
  { nivel: 4, rotulo: "Energia" },
  { nivel: 5, rotulo: "Lendária" },
];

export const LIMITE_TITULO_DESAFIO = 40;
const LIMITE_DIAS = 366;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const MODALIDADES: Modalidade[] = ["corrida", "bicicleta"];

export function modalidadesDoDesafio(d: Pick<DesafioDoc, "modalidade">): Modalidade[] {
  return d.modalidade === "todas" ? MODALIDADES : [d.modalidade];
}

function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Valida o que veio do formulário (ou da API) e devolve o desafio limpo. */
export function validarDesafio(entrada: unknown): { dados: Omit<DesafioDoc, "id" | "atualizadoPorNome"> } | { erro: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const titulo = String(e.titulo ?? "").trim().replace(/\s+/g, " ");
  if (titulo.length < 3) return { erro: "Dê um nome ao desafio (pelo menos 3 letras)." };
  if (titulo.length > LIMITE_TITULO_DESAFIO) return { erro: `O nome pode ter até ${LIMITE_TITULO_DESAFIO} caracteres.` };

  const modalidade = e.modalidade === "corrida" || e.modalidade === "bicicleta" ? e.modalidade : e.modalidade === "todas" ? "todas" : null;
  if (!modalidade) return { erro: "Escolha a modalidade." };
  const tipo = typeof e.tipo === "string" && e.tipo in TIPO_DESAFIO ? (e.tipo as TipoDesafio) : null;
  if (!tipo) return { erro: "Escolha o tipo de meta." };

  const brutas = (e.metas && typeof e.metas === "object" ? e.metas : {}) as Record<string, unknown>;
  const metas: Partial<Record<Modalidade, number>> = {};
  for (const m of modalidadesDoDesafio({ modalidade })) {
    const valor = Number(brutas[m]);
    if (!Number.isInteger(valor) || valor < 1) {
      return { erro: modalidade === "todas" && tipo === "km" ? `Informe a meta em km para ${m === "corrida" ? "Corrida" : "Bike"} (número inteiro).` : "Informe a meta com um número inteiro maior que zero." };
    }
    if (valor > 100_000) return { erro: "A meta está alta demais. Confira o número." };
    metas[m] = valor;
  }

  const inicio = String(e.inicio ?? "");
  const fim = String(e.fim ?? "");
  if (!ISO.test(inicio) || !ISO.test(fim)) return { erro: "Informe o início e o fim do desafio." };
  if (fim < inicio) return { erro: "O fim precisa ser depois do início." };
  if (diasEntre(inicio, fim) > LIMITE_DIAS) return { erro: "O desafio pode durar até um ano." };
  if (tipo === "semanas") {
    const semanas = Math.floor(diasEntre(segundaDaSemana(inicio), segundaDaSemana(fim)) / 7) + 1;
    const maior = Math.max(...Object.values(metas));
    if (maior > semanas) return { erro: `O período tem ${semanas} ${semanas === 1 ? "semana" : "semanas"}: a meta não pode passar disso.` };
  }

  const icone = ICONES_DESAFIO.some((i) => i.id === e.icone) ? (e.icone as IconeMedalha) : "bandeira";
  const nivel = [1, 2, 3, 4, 5].includes(Number(e.nivel)) ? (Number(e.nivel) as NivelMedalha) : 3;
  return { dados: { titulo, modalidade, tipo, metas, inicio, fim, icone, nivel } };
}

export type StatusDesafio = "agendado" | "ativo" | "encerrado";

export function statusDoDesafio(d: Pick<DesafioDoc, "inicio" | "fim">, hoje: string): StatusDesafio {
  if (hoje < d.inicio) return "agendado";
  if (hoje > d.fim) return "encerrado";
  return "ativo";
}

/** Dias que faltam contando hoje (o último dia vale 1). */
export function diasRestantes(d: Pick<DesafioDoc, "fim">, hoje: string) {
  return Math.max(0, diasEntre(hoje, d.fim) + 1);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diaMes = (iso: string) => `${Number(iso.slice(8, 10))}/${iso.slice(5, 7)}`;

/** "1 a 31 de outubro", "15/10 a 15/11". */
export function textoPeriodo(d: Pick<DesafioDoc, "inicio" | "fim">) {
  if (d.inicio === d.fim) return `${Number(d.inicio.slice(8, 10))} de ${MESES[Number(d.inicio.slice(5, 7)) - 1]}`;
  if (d.inicio.slice(0, 7) === d.fim.slice(0, 7)) {
    return `${Number(d.inicio.slice(8, 10))} a ${Number(d.fim.slice(8, 10))} de ${MESES[Number(d.fim.slice(5, 7)) - 1]}`;
  }
  return `${diaMes(d.inicio)} a ${diaMes(d.fim)}`;
}

/** "de 1 a 31 de outubro" / "em 12 de outubro", para completar uma frase. */
export function noPeriodo(d: Pick<DesafioDoc, "inicio" | "fim">) {
  return `${d.inicio === d.fim ? "em" : "de"} ${textoPeriodo(d)}`;
}

/** "Some 40 km", "Faça 12 treinos", "Treine em 4 semanas diferentes", "Complete 1 prova". */
export function textoMeta(d: Pick<DesafioDoc, "tipo" | "metas">, modalidade: Modalidade) {
  const meta = d.metas[modalidade] ?? 0;
  const n = meta.toLocaleString("pt-BR");
  if (d.tipo === "km") return `Some ${n} km`;
  if (d.tipo === "treinos") return `Faça ${n} ${meta === 1 ? "treino" : "treinos"}`;
  if (d.tipo === "semanas") return meta === 1 ? "Treine em pelo menos 1 semana" : `Treine em ${n} semanas diferentes`;
  return `Complete ${n} ${meta === 1 ? "prova" : "provas"}`;
}

/** Meta das duas modalidades num texto só, para a gestão ("40 km na Corrida · 150 km na Bike"). */
export function textoMetaGestao(d: Pick<DesafioDoc, "tipo" | "metas" | "modalidade">) {
  const info = TIPO_DESAFIO[d.tipo];
  const un = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? info.singular : info.plural}`;
  const mods = modalidadesDoDesafio(d);
  const valores = mods.map((m) => d.metas[m] ?? 0);
  if (mods.length === 2 && valores[0] !== valores[1]) return `${un(valores[0])} na Corrida, ${un(valores[1])} na Bike`;
  return un(valores[0]);
}

export interface ProgressoDesafio {
  atual: number;
  meta: number;
  /** Dia em que completou (YYYY-MM-DD) ou null. */
  concluidoEm: string | null;
}

/** Progresso de um atleta num desafio, só com o que aconteceu dentro do período (e até hoje). */
export function progressoNoDesafio(params: {
  desafio: DesafioDoc;
  modalidade: Modalidade;
  lancamentos: readonly HistoricoPontoDoc[];
  regrasTreino: RegrasDeTreino | undefined;
  hoje: string;
}): ProgressoDesafio | null {
  const { desafio, modalidade, regrasTreino, hoje } = params;
  const meta = desafio.metas[modalidade];
  if (!meta || !modalidadesDoDesafio(desafio).includes(modalidade)) return null;
  const ate = hoje < desafio.fim ? hoje : desafio.fim;
  const noPeriodo = params.lancamentos.filter((l) => l.dataTreino >= desafio.inicio && l.dataTreino <= ate);

  let itens: { data: string; valor: number }[];
  if (desafio.tipo === "provas") {
    const provas = noPeriodo.filter((l) => !l.estornado && l.pontos > 0 && l.tipoLancamento === "evento");
    itens = consolidarAtividades(provas, regrasTreino).map((a) => ({ data: a.data, valor: 1 }));
  } else {
    const atividades = consolidarAtividades(noPeriodo, regrasTreino);
    if (desafio.tipo === "km") {
      itens = atividades.filter((a) => a.km > 0).map((a) => ({ data: a.data, valor: a.km }));
    } else if (desafio.tipo === "treinos") {
      itens = atividades.filter((a) => a.tipo === "treino").map((a) => ({ data: a.data, valor: 1 }));
    } else {
      // Uma entrada por semana: o primeiro treino de cada semana.
      const primeiro = new Map<string, string>();
      for (const a of atividades) {
        if (a.tipo !== "treino") continue;
        const s = segundaDaSemana(a.data);
        if (!primeiro.has(s) || a.data < primeiro.get(s)!) primeiro.set(s, a.data);
      }
      itens = [...primeiro.values()].map((data) => ({ data, valor: 1 }));
    }
  }
  const soma = itens.reduce((s, i) => s + i.valor, 0);
  const atual = desafio.tipo === "km" ? Math.floor(soma) : soma;
  return { atual: Math.min(atual, meta), meta, concluidoEm: diaQueAlcancou(itens, meta) };
}

export const idMedalhaDesafio = (desafioId: string) => `desafio_${desafioId}`;

export function medalhaDoDesafio(desafio: DesafioDoc, modalidade: Modalidade, p: ProgressoDesafio): MedalhaDoAtleta {
  const info = TIPO_DESAFIO[desafio.tipo];
  return {
    id: idMedalhaDesafio(desafio.id),
    titulo: desafio.titulo,
    descricao: `${textoMeta(desafio, modalidade)} ${noPeriodo(desafio)}.`,
    icone: desafio.icone,
    nivel: desafio.nivel,
    grupo: "desafios",
    unidade: { singular: info.singular, plural: info.plural },
    conquistada: p.concluidoEm !== null,
    em: p.concluidoEm,
    progresso: { atual: p.atual, meta: p.meta },
  };
}

export interface DesafioDoAtleta {
  desafio: DesafioDoc;
  status: StatusDesafio;
  progresso: ProgressoDesafio;
  medalha: MedalhaDoAtleta;
}

/**
 * Desafios da modalidade do atleta com o progresso de cada um. Ficam de fora
 * os encerrados que ele não completou (não é lugar de lembrar o que faltou).
 */
export function desafiosDoAtleta(params: {
  desafios: readonly DesafioDoc[];
  modalidade: Modalidade;
  lancamentos: readonly HistoricoPontoDoc[];
  regrasTreino: RegrasDeTreino | undefined;
  hoje: string;
}): DesafioDoAtleta[] {
  const out: DesafioDoAtleta[] = [];
  for (const desafio of params.desafios) {
    const progresso = progressoNoDesafio({ ...params, desafio });
    if (!progresso) continue;
    const status = statusDoDesafio(desafio, params.hoje);
    if (status === "encerrado" && !progresso.concluidoEm) continue;
    out.push({ desafio, status, progresso, medalha: medalhaDoDesafio(desafio, params.modalidade, progresso) });
  }
  const ordem: Record<StatusDesafio, number> = { ativo: 0, agendado: 1, encerrado: 2 };
  return out.sort(
    (a, b) =>
      ordem[a.status] - ordem[b.status] ||
      // Entre os ativos, o que ainda dá para buscar vem antes do que já foi completado.
      Number(a.progresso.concluidoEm !== null) - Number(b.progresso.concluidoEm !== null) ||
      (a.status === "encerrado" ? b.desafio.fim.localeCompare(a.desafio.fim) : a.desafio.fim.localeCompare(b.desafio.fim)),
  );
}

/** Mensagem do aviso de desafio novo (uma por modalidade, porque a meta pode mudar). */
export function mensagemDeDesafioNovo(d: DesafioDoc, modalidade: Modalidade, hoje: string) {
  const quando = statusDoDesafio(d, hoje) === "agendado" ? ` Começa em ${diaMes(d.inicio)}.` : "";
  return {
    titulo: `Novo desafio: ${d.titulo}`.slice(0, 60),
    corpo: `${textoMeta(d, modalidade)} ${noPeriodo(d)} e ganhe a medalha.${quando}`.slice(0, 180),
  };
}

export interface ParticipanteDesafio<A> {
  atleta: A;
  modalidade: Modalidade;
  progresso: ProgressoDesafio;
}

/**
 * Para a gestão: todos os atletas ativos da modalidade do desafio com o
 * progresso de cada um. Quem completou primeiro vem antes; depois, quem está
 * mais perto da meta.
 */
export function participacaoNoDesafio<A extends { id: string; nome: string; equipe: string; ativo: boolean; visivelNasListas?: boolean }>(params: {
  desafio: DesafioDoc;
  atletas: readonly A[];
  /** Lançamentos já agrupados por atleta (evita varrer tudo para cada desafio). */
  porAtleta: ReadonlyMap<string, HistoricoPontoDoc[]>;
  regrasTreino: RegrasDeTreino | undefined;
  hoje: string;
}) {
  const mods = modalidadesDoDesafio(params.desafio);
  const lista: ParticipanteDesafio<A>[] = [];
  for (const atleta of params.atletas) {
    if (!atleta.ativo || atleta.visivelNasListas === false) continue;
    const modalidade = mods.find((m) => m === atleta.equipe);
    if (!modalidade) continue;
    const progresso = progressoNoDesafio({ desafio: params.desafio, modalidade, lancamentos: params.porAtleta.get(atleta.id) ?? [], regrasTreino: params.regrasTreino, hoje: params.hoje });
    if (progresso) lista.push({ atleta, modalidade, progresso });
  }
  lista.sort((a, b) => {
    const ca = a.progresso.concluidoEm;
    const cb = b.progresso.concluidoEm;
    if (ca && cb) return ca.localeCompare(cb) || a.atleta.nome.localeCompare(b.atleta.nome, "pt-BR");
    if (ca || cb) return ca ? -1 : 1;
    return b.progresso.atual / b.progresso.meta - a.progresso.atual / a.progresso.meta || a.atleta.nome.localeCompare(b.atleta.nome, "pt-BR");
  });
  return { participantes: lista, concluidos: lista.filter((p) => p.progresso.concluidoEm).length };
}

export function agruparPorAtleta(lancamentos: readonly HistoricoPontoDoc[]) {
  const mapa = new Map<string, HistoricoPontoDoc[]>();
  for (const l of lancamentos) {
    const lista = mapa.get(l.atletaId);
    if (lista) lista.push(l);
    else mapa.set(l.atletaId, [l]);
  }
  return mapa;
}
