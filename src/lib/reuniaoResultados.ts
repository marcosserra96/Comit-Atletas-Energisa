/**
 * Reunião de resultados: o que vai em cada slide, calculado a partir dos dados
 * do portal. Mesmas regras do ranking publicado (pontos definem a posição,
 * empates dividem a colocação, só treinos únicos contam).
 *
 * Tudo aqui é puro: a tela carrega os dados e chama estas funções.
 */
import { calcularResultadosRanking } from "@/lib/rankingPeriods";
import { calcularPosicoesRanking, montarPodio, type DegrauDoPodio } from "@/lib/rankingPosition";
import type { RegrasDeTreino } from "@/lib/activityConsolidation";
import { formatKmTotal, formatPontos, plural } from "@/lib/format";
import { modalidadeLabel } from "@/lib/labels";
import type { AtletaDoc, EventoDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade, RegraPontuacaoDoc } from "@/lib/types";

// ---------- configuração salva da reunião ----------

export type TipoSecao =
  | "capa"
  | "presenca"
  | "novos"
  | "aniversariantes"
  | "regras"
  | "resultados"
  | "destaques"
  | "premiacao"
  | "agenda"
  | "app"
  | "sorteio"
  | "obrigado"
  | "livre";

export interface SecaoReuniao {
  id: string;
  tipo: TipoSecao;
  ativo: boolean;
}

/** Slide escrito pelo comitê: divisória (título grande) ou conteúdo (texto e/ou imagem). */
export interface SlideLivre {
  id: string;
  layout: "divisoria" | "conteudo";
  titulo: string;
  /** Linha de cima, colorida, nas divisórias ("Fala da"). */
  sobretitulo: string;
  texto: string;
  imagemId: string | null;
  /** Formatação escolhida pelo comitê (fonte, cores, fundo…). Ausente = visual padrão. */
  estilo?: Partial<EstiloLivre>;
}

// ---------- formatação dos slides livres ----------

export type FonteSlide = "barlow" | "condensada" | "montserrat" | "serifada";
export type FundoLivre = "conteudo" | "claro" | "divisoria" | "resultados" | "premiacao" | "agenda" | "cor";

export interface EstiloLivre {
  fonte: FonteSlide;
  /** Escala do texto sobre o tamanho automático. */
  tamanho: "auto" | "p" | "m" | "g" | "gg";
  /** null = cor padrão do layout (ajusta sozinha a fundos escuros). */
  corTitulo: string | null;
  corTexto: string | null;
  /** Linha de cima das divisórias, borda e número dos itens. */
  corDestaque: string | null;
  alinhamento: "esquerda" | "centro";
  lista: "numerada" | "marcadores" | "paragrafo";
  fundo: FundoLivre;
  corFundo: string;
  imagemLado: "direita" | "esquerda";
}

export const FONTES_SLIDE: Record<FonteSlide, { nome: string; familia: string }> = {
  barlow: { nome: "Padrão", familia: "'Barlow', 'Helvetica Neue', Arial, sans-serif" },
  condensada: { nome: "Condensada", familia: "'Barlow Condensed', 'Barlow', Arial, sans-serif" },
  montserrat: { nome: "Montserrat", familia: "'Montserrat', 'Helvetica Neue', Arial, sans-serif" },
  serifada: { nome: "Serifada", familia: "'Merriweather', Georgia, serif" },
};

export const ESCALA_TAMANHO: Record<EstiloLivre["tamanho"], number> = { auto: 1, p: 0.8, m: 1, g: 1.2, gg: 1.4 };

const HEX = /^#[0-9a-f]{6}$/i;

/** Formatação completa do slide livre: o que o comitê escolheu sobre o padrão do layout. */
export function estiloDoLivre(l: Pick<SlideLivre, "layout" | "estilo">): EstiloLivre {
  const e = l.estilo ?? {};
  const cor = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : null);
  const um = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T => (opcoes.includes(v as T) ? (v as T) : padrao);
  const divisoria = l.layout === "divisoria";
  return {
    fonte: um(e.fonte, ["barlow", "condensada", "montserrat", "serifada"] as const, "barlow"),
    tamanho: um(e.tamanho, ["auto", "p", "m", "g", "gg"] as const, "auto"),
    corTitulo: cor(e.corTitulo),
    corTexto: cor(e.corTexto),
    corDestaque: cor(e.corDestaque),
    alinhamento: um(e.alinhamento, ["esquerda", "centro"] as const, divisoria ? "centro" : "esquerda"),
    lista: um(e.lista, ["numerada", "marcadores", "paragrafo"] as const, "numerada"),
    fundo: um(e.fundo, ["conteudo", "claro", "divisoria", "resultados", "premiacao", "agenda", "cor"] as const, divisoria ? "divisoria" : "conteudo"),
    corFundo: cor(e.corFundo) ?? "#0b2c5f",
    imagemLado: um(e.imagemLado, ["direita", "esquerda"] as const, "direita"),
  };
}

/** Só o que difere do padrão (para salvar pouco e voltar ao padrão quando tudo é desfeito). */
export function estiloSalvo(layout: SlideLivre["layout"], estilo: Partial<EstiloLivre> | undefined): Partial<EstiloLivre> | undefined {
  if (!estilo) return undefined;
  const padrao = estiloDoLivre({ layout });
  const completo = estiloDoLivre({ layout, estilo });
  const out: Partial<EstiloLivre> = {};
  for (const k of Object.keys(completo) as (keyof EstiloLivre)[]) {
    if (completo[k] !== padrao[k]) (out as Record<string, unknown>)[k] = completo[k];
  }
  if (completo.fundo === "cor") out.corFundo = completo.corFundo;
  else delete out.corFundo;
  return Object.keys(out).length ? out : undefined;
}

export type TransicaoSlide = "nenhuma" | "esmaecer" | "deslizar" | "zoom";

export interface TemaReuniao {
  fonte: FonteSlide;
  transicao: TransicaoSlide;
  /** Os elementos de cada slide entram um a um. */
  animacoes: boolean;
  /** No pódio, cada clique revela um lugar: 3º, 2º e por fim o 1º. */
  revelarPodio: boolean;
}

export function temaDaReuniao(tema: Partial<TemaReuniao> | undefined): TemaReuniao {
  const t = tema ?? {};
  return {
    fonte: (["barlow", "condensada", "montserrat", "serifada"] as const).includes(t.fonte as FonteSlide) ? (t.fonte as FonteSlide) : "barlow",
    transicao: (["nenhuma", "esmaecer", "deslizar", "zoom"] as const).includes(t.transicao as TransicaoSlide) ? (t.transicao as TransicaoSlide) : "esmaecer",
    animacoes: t.animacoes !== false,
    revelarPodio: t.revelarPodio !== false,
  };
}

/** Quantos cliques um slide tem antes de passar para o próximo (pódio revelado aos poucos). */
export function passosDoSlide(slide: SlideDef | undefined, tema: TemaReuniao) {
  return slide?.tipo === "podio" && tema.revelarPodio ? slide.podio.length : 0;
}

/** Fundo escuro pede texto claro: luminância relativa abaixo de ~0,35. */
export function fundoEscuro(hex: string) {
  if (!HEX.test(hex)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}

export interface ReuniaoResultadosDoc {
  id: string;
  titulo: string;
  /** Período dos números (normalmente um trimestre do calendário). */
  periodo: { nome: string; inicio: string; fim: string };
  /** Reunião da agenda (QR de presença). */
  eventoId: string | null;
  secoes: SecaoReuniao[];
  livres: SlideLivre[];
  /** Ajustes manuais na lista de novos atletas. */
  novosIncluir: string[];
  novosExcluir: string[];
  /** Anotações do apresentador por seção (aparecem só na tela do apresentador). */
  notas?: Record<string, string>;
  /** Aparência da apresentação inteira: fonte, transição e animações. */
  tema?: Partial<TemaReuniao>;
  atualizadoEm?: string | null;
  atualizadoPorNome?: string | null;
}

export const TITULO_SECAO: Record<Exclude<TipoSecao, "livre">, { titulo: string; dica: string }> = {
  capa: { titulo: "Capa", dica: "Resultados do ano e o período" },
  presenca: { titulo: "Registre sua presença", dica: "QR code da reunião, ao vivo" },
  novos: { titulo: "Boas-vindas aos novos atletas", dica: "Quem entrou nas equipes no período" },
  aniversariantes: { titulo: "Aniversariantes", dica: "Quem fez aniversário no período (só aparece se houver)" },
  regras: { titulo: "Regras de pontuação", dica: "Critérios cadastrados e períodos de apuração" },
  resultados: { titulo: "Resultados totais", dica: "Atletas, treinos, pontos e km, com o período anterior" },
  destaques: { titulo: "Destaques do período", dica: "Quem mais evoluiu, maior sequência, mais km e desafios" },
  premiacao: { titulo: "Premiação", dica: "Pódio e classificação de cada equipe" },
  agenda: { titulo: "Agenda", dica: "Programação de eventos do ano" },
  app: { titulo: "Aplicativo", dica: "QR code para instalar o app" },
  sorteio: { titulo: "Sorteio", dica: "Sorteio ao vivo entre quem registrou presença" },
  obrigado: { titulo: "Obrigado", dica: "Encerramento" },
};

function novoId(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Roteiro padrão: o mesmo da reunião de setembro. */
export function reuniaoPadrao(periodo: { nome: string; inicio: string; fim: string }, eventoId: string | null): Omit<ReuniaoResultadosDoc, "id"> {
  const diretoria: SlideLivre = { id: novoId("l"), layout: "divisoria", sobretitulo: "Fala da", titulo: "Diretoria", texto: "", imagemId: null };
  const combinados: SlideLivre = {
    id: novoId("l"),
    layout: "conteudo",
    sobretitulo: "",
    titulo: "Relembrando nossos combinados",
    texto:
      "Presença nos treinos agendados, no mínimo 1 vez na semana\nRealizar pelo menos 2 treinos semanais\nParticipar dos eventos do programa\nUso do uniforme nos treinos e eventos\nTreino mínimo de 5 km (corrida) e 15 km (bike)",
    imagemId: null,
  };
  const avisos: SlideLivre = { id: novoId("l"), layout: "divisoria", sobretitulo: "Avisos", titulo: "Importantes!", texto: "", imagemId: null };
  const s = (tipo: TipoSecao, livreId?: string): SecaoReuniao => ({ id: livreId ?? novoId("s"), tipo, ativo: true });
  return {
    titulo: `Reunião de resultados · ${periodo.nome}`,
    periodo,
    eventoId,
    secoes: [
      s("capa"),
      s("presenca"),
      s("livre", diretoria.id),
      s("novos"),
      s("aniversariantes"),
      s("livre", combinados.id),
      s("regras"),
      s("resultados"),
      s("destaques"),
      s("premiacao"),
      s("agenda"),
      s("livre", avisos.id),
      s("app"),
      { ...s("sorteio"), ativo: false },
      s("obrigado"),
    ],
    livres: [diretoria, combinados, avisos],
    novosIncluir: [],
    novosExcluir: [],
  };
}

/**
 * Reuniões salvas antes de existirem seções novas ganham essas seções no lugar
 * certo (ligadas; as que dependem de dados somem sozinhas quando não há o que mostrar).
 */
export function completarSecoes<T extends Pick<ReuniaoResultadosDoc, "secoes">>(reuniao: T): T {
  const secoes = [...reuniao.secoes];
  const garantir = (tipo: TipoSecao, vizinho: TipoSecao, lado: "depois" | "antes" = "depois", ativo = true) => {
    if (secoes.some((x) => x.tipo === tipo)) return;
    const i = secoes.findIndex((x) => x.tipo === vizinho);
    secoes.splice(i < 0 ? secoes.length : lado === "depois" ? i + 1 : i, 0, { id: novoId("s"), tipo, ativo });
  };
  garantir("aniversariantes", "novos");
  garantir("destaques", "resultados");
  // Sorteio entra desligado: só faz sentido quando há brinde.
  garantir("sorteio", "obrigado", "antes", false);
  return secoes.length === reuniao.secoes.length ? reuniao : { ...reuniao, secoes };
}

export function novoSlideLivre(layout: SlideLivre["layout"]): SlideLivre {
  return { id: novoId("l"), layout, sobretitulo: "", titulo: layout === "divisoria" ? "Novo tema" : "Novo slide", texto: "", imagemId: null };
}

/** Limpa o que veio do navegador antes de salvar (servidor). */
export function validarReuniao(entrada: unknown): { erro: string } | { dados: Omit<ReuniaoResultadosDoc, "id" | "atualizadoEm" | "atualizadoPorNome"> } {
  const e = (entrada ?? {}) as Partial<ReuniaoResultadosDoc>;
  const data = /^\d{4}-\d{2}-\d{2}$/;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const periodo = e.periodo ?? ({} as ReuniaoResultadosDoc["periodo"]);
  if (!data.test(periodo.inicio ?? "") || !data.test(periodo.fim ?? "") || periodo.fim < periodo.inicio) {
    return { erro: "Escolha o período dos resultados." };
  }
  const tipos = new Set<TipoSecao>(["capa", "presenca", "novos", "aniversariantes", "regras", "resultados", "destaques", "premiacao", "agenda", "app", "sorteio", "obrigado", "livre"]);
  const livres = (Array.isArray(e.livres) ? e.livres : []).slice(0, 30).map((l) => ({
    id: texto(l?.id, 40) || novoId("l"),
    layout: l?.layout === "divisoria" ? ("divisoria" as const) : ("conteudo" as const),
    titulo: texto(l?.titulo, 120),
    sobretitulo: texto(l?.sobretitulo, 60),
    texto: texto(l?.texto, 1500),
    imagemId: typeof l?.imagemId === "string" && l.imagemId.length < 60 ? l.imagemId : null,
    ...(() => {
      const layout = l?.layout === "divisoria" ? ("divisoria" as const) : ("conteudo" as const);
      const estilo = estiloSalvo(layout, l?.estilo && typeof l.estilo === "object" ? l.estilo : undefined);
      return estilo ? { estilo } : {};
    })(),
  }));
  const idsLivres = new Set(livres.map((l) => l.id));
  const secoes = (Array.isArray(e.secoes) ? e.secoes : [])
    .slice(0, 50)
    .filter((s) => s && tipos.has(s.tipo) && (s.tipo !== "livre" || idsLivres.has(s.id)))
    .map((s) => ({ id: texto(s.id, 40), tipo: s.tipo, ativo: s.ativo !== false }));
  if (secoes.length === 0) return { erro: "A reunião precisa de ao menos um slide." };
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length < 200).slice(0, 300) : []);
  return {
    dados: {
      titulo: texto(e.titulo, 120) || `Reunião de resultados · ${texto(periodo.nome, 60)}`,
      periodo: { nome: texto(periodo.nome, 60) || "Período", inicio: periodo.inicio, fim: periodo.fim },
      eventoId: typeof e.eventoId === "string" && e.eventoId ? e.eventoId.slice(0, 200) : null,
      secoes,
      livres,
      novosIncluir: ids(e.novosIncluir),
      novosExcluir: ids(e.novosExcluir),
      tema: temaDaReuniao(e.tema && typeof e.tema === "object" ? e.tema : undefined),
      notas: Object.fromEntries(
        Object.entries(e.notas && typeof e.notas === "object" ? e.notas : {})
          .filter(([k, v]) => typeof v === "string" && v.trim() && k.length < 60)
          .slice(0, 60)
          .map(([k, v]) => [k, (v as string).slice(0, 2000)]),
      ),
    },
  };
}

// ---------- números do período ----------

export interface LinhaResultado {
  id: string;
  nome: string;
  posicao: number;
  pontos: number;
  treinos: number;
  km: number;
  fotoVersao?: number;
  /** Entrou na equipe dentro do período (marca na tabela). */
  novo: boolean;
}

export interface ResultadoEquipe {
  modalidade: Modalidade;
  ranking: LinhaResultado[];
  podio: DegrauDoPodio<LinhaResultado>[];
  totais: { atletas: number; treinos: number; pontos: number; km: number; kmPorTreino: number };
}

export function membroAtivoDaEquipe(a: AtletaDoc, mod: Modalidade) {
  return a.equipe === mod && a.ativo && a.visivelNasListas !== false;
}

/** Quem conta como novo: entrou na equipe dentro do período, mais os ajustes do comitê. */
export function novosAtletas(params: {
  atletas: AtletaDoc[];
  inicio: string;
  ate: string;
  incluir?: readonly string[];
  excluir?: readonly string[];
}) {
  const incluir = new Set(params.incluir ?? []);
  const excluir = new Set(params.excluir ?? []);
  return params.atletas
    .filter((a) => (a.equipe === "corrida" || a.equipe === "bicicleta") && a.visivelNasListas !== false)
    .filter((a) => {
      if (excluir.has(a.id)) return false;
      if (incluir.has(a.id)) return true;
      return !!a.entrouNaEquipeEm && a.entrouNaEquipeEm >= params.inicio && a.entrouNaEquipeEm <= params.ate;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function resultadosDaEquipe(params: {
  modalidade: Modalidade;
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais: HistoricoMensalDoc[];
  inicio: string;
  fim: string;
  regrasTreino?: RegrasDeTreino;
  novos?: ReadonlySet<string>;
}): ResultadoEquipe {
  const { modalidade } = params;
  const daEquipe = params.atletas.filter((a) => membroAtivoDaEquipe(a, modalidade));
  const porId = new Map(daEquipe.map((a) => [a.id, a]));
  const calculados = calcularResultadosRanking(
    daEquipe,
    params.lancamentos,
    "trimestre",
    params.inicio,
    params.fim,
    params.resumosMensais,
    params.regrasTreino,
  ).sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal || a.nome.localeCompare(b.nome, "pt-BR"));
  const posicoes = calcularPosicoesRanking(calculados.map((r) => r.pontuacaoTotal));
  const ranking: LinhaResultado[] = calculados.map((r, i) => ({
    id: r.atletaId,
    nome: r.nome,
    posicao: posicoes[i],
    pontos: r.pontuacaoTotal,
    treinos: r.treinos,
    km: r.km,
    fotoVersao: porId.get(r.atletaId)?.fotoVersao,
    novo: params.novos?.has(r.atletaId) ?? false,
  }));
  const treinos = ranking.reduce((s, r) => s + r.treinos, 0);
  const km = ranking.reduce((s, r) => s + r.km, 0);
  return {
    modalidade,
    ranking,
    podio: montarPodio(ranking, (r) => r.posicao, (r) => r.pontos),
    totais: {
      atletas: daEquipe.length,
      treinos,
      pontos: ranking.reduce((s, r) => s + r.pontos, 0),
      km,
      kmPorTreino: treinos > 0 ? km / treinos : 0,
    },
  };
}

/**
 * Tabela de classificação em slides. Cabem `porColuna` linhas por coluna com
 * folga até `maxPorColuna` (linhas mais baixas), em até `colunas` colunas.
 * Os atletas são divididos por igual entre os slides e as colunas, para nunca
 * sobrar um slide com um nome só (46 → um slide 16/15/15; 60 → dois de 30).
 */
export function paginarClassificacao<T>(linhas: readonly T[], porColuna = 15, colunas = 3, maxPorColuna = 18): T[][][] {
  if (linhas.length === 0) return [];
  const paginas = Math.ceil(linhas.length / (maxPorColuna * colunas));
  const porSlide = Math.ceil(linhas.length / paginas);
  const slides: T[][][] = [];
  for (let i = 0; i < linhas.length; i += porSlide) {
    const fatia = linhas.slice(i, i + porSlide);
    // Só as colunas necessárias, divididas por igual (44 → 15/15/14; 22 → 11/11).
    const nColunas = Math.min(colunas, Math.ceil(fatia.length / porColuna));
    const altura = Math.ceil(fatia.length / nColunas);
    const cols: T[][] = [];
    for (let c = 0; c < fatia.length; c += altura) cols.push(fatia.slice(c, c + altura));
    slides.push(cols);
  }
  return slides;
}

// ---------- regras e agenda ----------

export interface LinhaRegra {
  descricao: string;
  pontos: number;
  modalidade: RegraPontuacaoDoc["modalidade"];
}

/** Critérios para o slide: maiores pontuações primeiro, sem o técnico "falta justificada". */
export function regrasParaSlide(regras: readonly RegraPontuacaoDoc[]): LinhaRegra[] {
  return regras
    .filter((r) => r.id !== "falta_justificada" && r.pontos > 0)
    .map((r) => ({ descricao: r.descricao, pontos: r.pontos, modalidade: r.modalidade }))
    .sort((a, b) => b.pontos - a.pontos || a.descricao.localeCompare(b.descricao, "pt-BR"))
    .slice(0, 8);
}

export interface ColunaAgenda {
  titulo: string;
  eventos: { id: string; data: string; titulo: string; local: string; feito: boolean }[];
}

/**
 * Programação do ano por equipe (como o slide "Programação"): eventos de
 * reunião ficam de fora; os já realizados aparecem marcados.
 */
export function agendaDoAno(eventos: readonly EventoDoc[], ano: string, hoje: string): ColunaAgenda[] {
  const doAno = eventos
    .filter((e) => e.tipo !== "reuniao" && e.data.startsWith(ano))
    .sort((a, b) => a.data.localeCompare(b.data));
  const item = (e: EventoDoc) => ({ id: e.id, data: e.data, titulo: e.titulo, local: e.local, feito: e.data < hoje });
  const colunas: ColunaAgenda[] = [
    { titulo: "Time Corrida", eventos: doAno.filter((e) => e.modalidade === "corrida").map(item) },
    { titulo: "Time Bike", eventos: doAno.filter((e) => e.modalidade === "bicicleta").map(item) },
    { titulo: "Corrida + Bike", eventos: doAno.filter((e) => e.modalidade === "ambas").map(item) },
  ];
  return colunas.filter((c) => c.eventos.length > 0);
}

// ---------- roteiro: a lista final de slides ----------

const MESES_NOME = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "Junho – Julho – Agosto" (até 4 meses) ou "Junho a Novembro". */
export function mesesDoPeriodo(inicio: string, fim: string) {
  const [a1, m1] = inicio.split("-").map(Number);
  const [a2, m2] = fim.split("-").map(Number);
  const total = (a2 - a1) * 12 + (m2 - m1) + 1;
  if (total <= 1) return MESES_NOME[m1 - 1];
  if (total <= 4) {
    return Array.from({ length: total }, (_, i) => MESES_NOME[(m1 - 1 + i) % 12]).join(" – ");
  }
  return `${MESES_NOME[m1 - 1]} a ${MESES_NOME[m2 - 1]}`;
}

/** "(Junho a Agosto)" */
export function intervaloDeMeses(inicio: string, fim: string) {
  const m1 = Number(inicio.slice(5, 7));
  const m2 = Number(fim.slice(5, 7));
  return m1 === m2 ? `(${MESES_NOME[m1 - 1]})` : `(${MESES_NOME[m1 - 1]} a ${MESES_NOME[m2 - 1]})`;
}

export interface PeriodoApuracao {
  nome: string;
  intervalo: string;
  situacao: "fechado" | "andamento" | "proximo";
}

export interface NovoAtletaSlide {
  id: string;
  nome: string;
  modalidade: Modalidade;
  fotoVersao?: number;
}

export type FundoDivisoria = "divisoria" | "resultados" | "premiacao" | "agenda";

export type SlideDef = (
  | { chave: string; tipo: "capa"; ano: string; meses: string }
  | { chave: string; tipo: "presenca"; evento: { id: string; titulo: string; horario: string } | null; pontos: number | null }
  | { chave: string; tipo: "divisoria"; sobretitulo: string; titulo: string; subtitulo: string; fundo: FundoDivisoria; estilo?: EstiloLivre }
  | { chave: string; tipo: "novos"; atletas: NovoAtletaSlide[]; pagina: number; paginas: number }
  | { chave: string; tipo: "conteudo"; titulo: string; texto: string; imagemId: string | null; estilo: EstiloLivre }
  | { chave: string; tipo: "regras"; regras: LinhaRegra[]; periodos: PeriodoApuracao[] }
  | {
      chave: string;
      tipo: "totais";
      titulo: string;
      periodo: string;
      corrida: ResultadoEquipe["totais"];
      bicicleta: ResultadoEquipe["totais"];
      /** Totais do período anterior, para mostrar a variação. */
      anterior: { nome: string; treinos: number; pontos: number; km: number } | null;
    }
  | { chave: string; tipo: "destaques"; periodo: string; itens: Destaque[]; desafios: DesafioConcluido[] }
  | { chave: string; tipo: "aniversariantes"; atletas: Aniversariante[]; pagina: number; paginas: number }
  | { chave: string; tipo: "podio"; modalidade: Modalidade; periodo: string; podio: ResultadoEquipe["podio"] }
  | { chave: string; tipo: "classificacao"; modalidade: Modalidade; periodo: string; colunas: LinhaResultado[][]; pagina: number; paginas: number; temNovos: boolean }
  | { chave: string; tipo: "agenda"; ano: string; colunas: ColunaAgenda[] }
  | { chave: string; tipo: "app" }
  | { chave: string; tipo: "sorteio" }
  | { chave: string; tipo: "obrigado" }
) & {
  /** Seção do roteiro que gerou o slide (para ligar a lista aos slides). */
  secaoId?: string;
  /** Nome curto do slide na lista de miniaturas ("Premiação · Corrida"). */
  rotulo?: string;
};

export const NOVOS_POR_SLIDE = 10;
export const ANIVERSARIANTES_POR_SLIDE = 10;

// ---------- destaques, aniversariantes e período anterior ----------

export interface Destaque {
  /** "evolucao" | "sequencia" | "km-corrida" | "km-bicicleta" */
  id: string;
  titulo: string;
  atleta: { id: string; nome: string; modalidade: Modalidade; fotoVersao?: number };
  /** Número grande ("+12", "9", "1.370"). */
  valor: string;
  /** Unidade ao lado do número ("treinos a mais", "semanas seguidas", "km"). */
  unidade: string;
  detalhe: string;
}

export interface DesafioConcluido {
  titulo: string;
  concluidos: number;
  participantes: number;
}

export interface Aniversariante {
  id: string;
  nome: string;
  modalidade: Modalidade;
  /** "12/07" */
  dia: string;
  fotoVersao?: number;
}

/** Quem faz aniversário entre as datas (vale para qualquer ano de nascimento). */
export function aniversariantesDoPeriodo(atletas: readonly AtletaDoc[], inicio: string, fim: string): Aniversariante[] {
  const dentro = (mmdd: string) => {
    for (let ano = Number(inicio.slice(0, 4)); ano <= Number(fim.slice(0, 4)); ano++) {
      const data = `${ano}-${mmdd}`;
      if (data >= inicio && data <= fim) return data;
    }
    return null;
  };
  return atletas
    .filter((a) => (membroAtivoDaEquipe(a, "corrida") || membroAtivoDaEquipe(a, "bicicleta")) && /^\d{4}-\d{2}-\d{2}$/.test(a.dataNascimento ?? ""))
    .map((a) => ({ a, data: dentro(a.dataNascimento!.slice(5)) }))
    .filter((x): x is { a: AtletaDoc; data: string } => x.data !== null)
    .sort((x, y) => x.data.localeCompare(y.data) || x.a.nome.localeCompare(y.a.nome, "pt-BR"))
    .map(({ a, data }) => ({ id: a.id, nome: a.nome, modalidade: a.equipe as Modalidade, dia: `${data.slice(8, 10)}/${data.slice(5, 7)}`, fotoVersao: a.fotoVersao }));
}

/**
 * Período anterior para comparar: o trimestre do calendário que termina antes
 * deste começar; sem calendário, a mesma quantidade de dias logo antes.
 */
export function periodoAnterior(periodo: { inicio: string; fim: string }, trimestres: readonly { nome: string; inicio: string; fim: string }[]) {
  const t = [...trimestres].filter((x) => x.fim < periodo.inicio).sort((a, b) => a.fim.localeCompare(b.fim)).at(-1);
  if (t) return { nome: t.nome, inicio: t.inicio, fim: t.fim };
  const dia = (iso: string, n: number) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const dias = Math.round((Date.parse(`${periodo.fim}T12:00:00Z`) - Date.parse(`${periodo.inicio}T12:00:00Z`)) / 86_400_000);
  const fim = dia(periodo.inicio, -1);
  return { nome: "período anterior", inicio: dia(fim, -dias), fim };
}

/** O começo do período anterior com a mesma duração já corrida ("2º Trimestre até 12/07"). */
export function trechoEquivalente(anterior: { nome: string; inicio: string; fim: string }, inicioAtual: string, ate: string) {
  const corridos = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${inicioAtual}T12:00:00Z`)) / 86_400_000);
  const d = new Date(`${anterior.inicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + corridos);
  const fim = d.toISOString().slice(0, 10);
  if (fim >= anterior.fim) return anterior;
  return { nome: `${anterior.nome} até ${fim.slice(8, 10)}/${fim.slice(5, 7)}`, inicio: anterior.inicio, fim };
}

/**
 * Destaques além do pódio: quem mais evoluiu (treinos a mais que no período
 * anterior), a maior sequência de semanas treinando até o fim do período e
 * quem mais somou km em cada equipe.
 */
export function destaquesDoPeriodo(params: {
  atletas: readonly AtletaDoc[];
  atual: { corrida: ResultadoEquipe; bicicleta: ResultadoEquipe };
  anterior: { corrida: ResultadoEquipe; bicicleta: ResultadoEquipe } | null;
  /** Semanas seguidas até o fim do período, por atleta. */
  sequencias: ReadonlyMap<string, number>;
}): Destaque[] {
  const porId = new Map(params.atletas.map((a) => [a.id, a]));
  const pessoa = (id: string, modalidade: Modalidade) => {
    const a = porId.get(id);
    return { id, nome: a?.nome ?? "", modalidade, fotoVersao: a?.fotoVersao };
  };
  const linhas = (["corrida", "bicicleta"] as const).flatMap((m) => params.atual[m].ranking.map((l) => ({ ...l, modalidade: m })));
  const out: Destaque[] = [];

  if (params.anterior) {
    const antes = new Map((["corrida", "bicicleta"] as const).flatMap((m) => params.anterior![m].ranking.map((l) => [l.id, l.treinos] as const)));
    const melhor = linhas
      .map((l) => ({ l, ganho: l.treinos - (antes.get(l.id) ?? 0) }))
      .filter((x) => x.ganho > 0)
      .sort((a, b) => b.ganho - a.ganho || b.l.treinos - a.l.treinos || a.l.nome.localeCompare(b.l.nome, "pt-BR"))[0];
    if (melhor) {
      const de = antes.get(melhor.l.id) ?? 0;
      out.push({
        id: "evolucao",
        titulo: "Quem mais evoluiu",
        atleta: pessoa(melhor.l.id, melhor.l.modalidade),
        valor: `+${melhor.ganho}`,
        unidade: melhor.ganho === 1 ? "treino a mais" : "treinos a mais",
        detalhe: `De ${de} para ${melhor.l.treinos} treinos`,
      });
    }
  }

  const seq = linhas
    .map((l) => ({ l, semanas: params.sequencias.get(l.id) ?? 0 }))
    .filter((x) => x.semanas >= 2)
    .sort((a, b) => b.semanas - a.semanas || b.l.treinos - a.l.treinos || a.l.nome.localeCompare(b.l.nome, "pt-BR"))[0];
  if (seq) {
    out.push({
      id: "sequencia",
      titulo: "Maior sequência",
      atleta: pessoa(seq.l.id, seq.l.modalidade),
      valor: String(seq.semanas),
      unidade: "semanas seguidas",
      detalhe: "Treinou em todas, sem falhar",
    });
  }

  for (const m of ["corrida", "bicicleta"] as const) {
    const top = [...params.atual[m].ranking].filter((l) => l.km > 0).sort((a, b) => b.km - a.km || a.nome.localeCompare(b.nome, "pt-BR"))[0];
    if (top) {
      out.push({
        id: `km-${m}`,
        titulo: `Mais km na ${m === "corrida" ? "Corrida" : "Bike"}`,
        atleta: pessoa(top.id, m),
        valor: Math.round(top.km).toLocaleString("pt-BR"),
        unidade: "km",
        detalhe: `Em ${top.treinos} ${top.treinos === 1 ? "treino" : "treinos"}`,
      });
    }
  }
  return out;
}

/** Junta a configuração da reunião com os números e devolve os slides, em ordem. */
export function montarRoteiro(params: {
  reuniao: Pick<ReuniaoResultadosDoc, "periodo" | "secoes" | "livres">;
  corrida: ResultadoEquipe;
  bicicleta: ResultadoEquipe;
  novos: NovoAtletaSlide[];
  regras: LinhaRegra[];
  periodos: PeriodoApuracao[];
  agenda: ColunaAgenda[];
  evento: { id: string; titulo: string; horario: string } | null;
  pontosReuniao: number | null;
  hoje: string;
  anterior?: { nome: string; corrida: ResultadoEquipe["totais"]; bicicleta: ResultadoEquipe["totais"] } | null;
  destaques?: { itens: Destaque[]; desafios: DesafioConcluido[] };
  aniversariantes?: Aniversariante[];
}): SlideDef[] {
  const { reuniao } = params;
  const { periodo } = reuniao;
  const ano = periodo.fim.slice(0, 4);
  const intervalo = intervaloDeMeses(periodo.inicio, periodo.fim);
  /** "2º Trimestre · Junho a Agosto 2026": contexto no canto dos slides de números. */
  const rotuloPeriodo = `${periodo.nome} · ${intervalo.replace(/[()]/g, "")} ${ano}`;
  const livres = new Map(reuniao.livres.map((l) => [l.id, l]));
  const slides: SlideDef[] = [];

  for (const secao of reuniao.secoes) {
    if (!secao.ativo) continue;
    const k = secao.id;
    const inicio = slides.length;
    switch (secao.tipo) {
      case "capa":
        slides.push({ chave: k, tipo: "capa", ano, meses: mesesDoPeriodo(periodo.inicio, periodo.fim) });
        break;
      case "presenca":
        slides.push({ chave: k, tipo: "presenca", evento: params.evento, pontos: params.pontosReuniao });
        break;
      case "livre": {
        const l = livres.get(secao.id);
        if (!l) break;
        if (l.layout === "divisoria") {
          slides.push({ chave: k, tipo: "divisoria", sobretitulo: l.sobretitulo, titulo: l.titulo, subtitulo: l.texto, fundo: "divisoria", estilo: estiloDoLivre(l) });
        } else {
          slides.push({ chave: k, tipo: "conteudo", titulo: l.titulo, texto: l.texto, imagemId: l.imagemId, estilo: estiloDoLivre(l) });
        }
        break;
      }
      case "novos": {
        if (params.novos.length === 0) break; // ninguém novo: a seção some
        slides.push({ chave: `${k}-div`, tipo: "divisoria", sobretitulo: "Boas-vindas", titulo: "Novos Atletas", subtitulo: "", fundo: "divisoria" });
        const paginas = Math.ceil(params.novos.length / NOVOS_POR_SLIDE);
        for (let p = 0; p < paginas; p++) {
          slides.push({
            chave: `${k}-${p}`,
            tipo: "novos",
            atletas: params.novos.slice(p * NOVOS_POR_SLIDE, (p + 1) * NOVOS_POR_SLIDE),
            pagina: p + 1,
            paginas,
          });
        }
        break;
      }
      case "regras":
        slides.push({ chave: k, tipo: "regras", regras: params.regras, periodos: params.periodos });
        break;
      case "resultados":
        slides.push({ chave: `${k}-div`, tipo: "divisoria", sobretitulo: "Resultados", titulo: periodo.nome, subtitulo: intervalo, fundo: "resultados" });
        slides.push({
          chave: k,
          tipo: "totais",
          titulo: "Resultados totais",
          periodo: rotuloPeriodo,
          corrida: params.corrida.totais,
          bicicleta: params.bicicleta.totais,
          anterior: params.anterior
            ? {
                nome: params.anterior.nome,
                treinos: params.anterior.corrida.treinos + params.anterior.bicicleta.treinos,
                pontos: params.anterior.corrida.pontos + params.anterior.bicicleta.pontos,
                km: params.anterior.corrida.km + params.anterior.bicicleta.km,
              }
            : null,
        });
        break;
      case "destaques":
        if (!params.destaques || (params.destaques.itens.length === 0 && params.destaques.desafios.length === 0)) break;
        slides.push({ chave: k, tipo: "destaques", periodo: rotuloPeriodo, itens: params.destaques.itens, desafios: params.destaques.desafios });
        break;
      case "aniversariantes": {
        const lista = params.aniversariantes ?? [];
        if (lista.length === 0) break; // ninguém: a seção some
        const paginas = Math.ceil(lista.length / ANIVERSARIANTES_POR_SLIDE);
        for (let pg = 0; pg < paginas; pg++) {
          slides.push({ chave: `${k}-${pg}`, tipo: "aniversariantes", atletas: lista.slice(pg * ANIVERSARIANTES_POR_SLIDE, (pg + 1) * ANIVERSARIANTES_POR_SLIDE), pagina: pg + 1, paginas });
        }
        break;
      }
      case "premiacao": {
        slides.push({ chave: `${k}-div`, tipo: "divisoria", sobretitulo: "Premiação", titulo: periodo.nome, subtitulo: intervalo, fundo: "premiacao" });
        for (const equipe of [params.corrida, params.bicicleta]) {
          if (equipe.ranking.length === 0) continue;
          if (equipe.podio.length > 0) slides.push({ chave: `${k}-${equipe.modalidade}-podio`, tipo: "podio", modalidade: equipe.modalidade, periodo: rotuloPeriodo, podio: equipe.podio });
          const paginasTabela = paginarClassificacao(equipe.ranking);
          paginasTabela.forEach((colunas, p) =>
            slides.push({
              chave: `${k}-${equipe.modalidade}-tab-${p}`,
              tipo: "classificacao",
              modalidade: equipe.modalidade,
              periodo: rotuloPeriodo,
              colunas,
              pagina: p + 1,
              paginas: paginasTabela.length,
              temNovos: colunas.some((c) => c.some((l) => l.novo)),
            }),
          );
        }
        break;
      }
      case "agenda":
        slides.push({ chave: `${k}-div`, tipo: "divisoria", sobretitulo: "Agenda", titulo: ano, subtitulo: "", fundo: "agenda" });
        if (params.agenda.length > 0) slides.push({ chave: k, tipo: "agenda", ano, colunas: params.agenda });
        break;
      case "app":
        slides.push({ chave: k, tipo: "app" });
        break;
      case "sorteio":
        slides.push({ chave: k, tipo: "sorteio" });
        break;
      case "obrigado":
        slides.push({ chave: k, tipo: "obrigado" });
        break;
    }
    const base = nomeDaSecao(secao, livres.get(secao.id));
    for (let j = inicio; j < slides.length; j++) slides[j] = { ...slides[j], secaoId: k, rotulo: rotuloDoSlide(slides[j], base) };
  }
  return slides;
}


/** Nome da seção como aparece no roteiro. */
export function nomeDaSecao(secao: Pick<SecaoReuniao, "tipo">, livre?: Pick<SlideLivre, "sobretitulo" | "titulo">) {
  if (secao.tipo === "livre") return [livre?.sobretitulo, livre?.titulo].filter(Boolean).join(" ") || "Slide livre";
  return TITULO_SECAO[secao.tipo].titulo;
}

function rotuloDoSlide(slide: SlideDef, base: string) {
  const pag = (p: number, t: number) => (t > 1 ? ` (${p}/${t})` : "");
  switch (slide.tipo) {
    case "podio":
      return `Pódio · ${modalidadeLabel[slide.modalidade]}`;
    case "classificacao":
      return `Classificação · ${modalidadeLabel[slide.modalidade]}${pag(slide.pagina, slide.paginas)}`;
    case "novos":
    case "aniversariantes":
      return `${base}${pag(slide.pagina, slide.paginas)}`;
    case "divisoria":
      // Divisória que abre uma seção automática (Resultados, Premiação…).
      return slide.chave.endsWith("-div") ? `${base} · abertura` : base;
    default:
      return base;
  }
}

// ---------- antes de apresentar ----------

export interface Verificacao {
  id: string;
  nivel: "atencao" | "info";
  texto: string;
  detalhe?: string;
  acao?: { rotulo: string; href: string };
}

/**
 * O que pode sair errado no telão: números incompletos, fotos faltando,
 * QR sem reunião, slide escrito vazio. Lista vazia = pronto para apresentar.
 */
export function verificarAntesDeApresentar(params: {
  reuniao: Pick<ReuniaoResultadosDoc, "periodo" | "secoes" | "livres" | "eventoId">;
  eventos: readonly Pick<EventoDoc, "id" | "titulo" | "data" | "tipo">[];
  lancamentos: readonly Pick<HistoricoPontoDoc, "eventoId" | "estornado">[];
  /** Quem aparece com foto nos slides (pódio e novos). */
  semFoto: readonly { id: string; nome: string }[];
  hoje: string;
}): Verificacao[] {
  const { reuniao, hoje } = params;
  const { periodo } = reuniao;
  const ativa = (tipo: TipoSecao) => reuniao.secoes.some((s) => s.tipo === tipo && s.ativo);
  const out: Verificacao[] = [];

  const lancados = new Set(params.lancamentos.filter((l) => !l.estornado && l.eventoId).map((l) => l.eventoId));
  const semPontos = params.eventos
    .filter((e) => e.tipo !== "reuniao" && e.data >= periodo.inicio && e.data <= periodo.fim && e.data < hoje && !lancados.has(e.id))
    .sort((a, b) => a.data.localeCompare(b.data));
  if (semPontos.length > 0 && (ativa("resultados") || ativa("premiacao"))) {
    out.push({
      id: "eventos",
      nivel: "atencao",
      texto: semPontos.length === 1 ? "1 evento do período está sem pontos lançados" : `${semPontos.length} eventos do período estão sem pontos lançados`,
      detalhe: `O ranking e o pódio ainda não contam: ${semPontos.map((e) => e.titulo).join(", ")}.`,
      acao: { rotulo: "Lançar pontos", href: `/gestao/pontuacao?evento=${encodeURIComponent(semPontos[0].id)}` },
    });
  }

  if (hoje <= periodo.fim && (ativa("resultados") || ativa("premiacao"))) {
    const [a, m, d] = periodo.fim.split("-");
    out.push({
      id: "periodo",
      nivel: "info",
      texto: "O período ainda não terminou",
      detalhe: `Os números vão mudar até ${Number(d)}/${m}/${a}. Para apresentar o resultado fechado, escolha um período encerrado.`,
    });
  }

  if (params.semFoto.length > 0) {
    out.push({
      id: "fotos",
      nivel: "atencao",
      texto: params.semFoto.length === 1 ? "1 atleta aparece sem foto" : `${params.semFoto.length} atletas aparecem sem foto`,
      detalhe: `Nos slides, só com as iniciais: ${params.semFoto.map((a) => a.nome).join(", ")}.`,
      acao: { rotulo: `Abrir a ficha de ${params.semFoto[0].nome.split(" ")[0]}`, href: `/gestao/atletas?ficha=${encodeURIComponent(params.semFoto[0].id)}` },
    });
  }

  if (ativa("presenca") && !reuniao.eventoId) {
    out.push({
      id: "presenca",
      nivel: "atencao",
      texto: "O slide de presença está sem reunião da agenda",
      detalhe: "Sem ela, não há QR code para registrar presença. Escolha a reunião em \"Reunião da agenda\" ou desligue o slide.",
    });
  }

  if (ativa("sorteio") && !reuniao.eventoId) {
    out.push({
      id: "sorteio",
      nivel: "atencao",
      texto: "O sorteio está sem reunião da agenda",
      detalhe: "Só concorre quem registra presença pelo QR code da reunião. Escolha a reunião em \"Reunião da agenda\" ou desligue o sorteio.",
    });
  }

  const ligados = new Set(reuniao.secoes.filter((s) => s.tipo === "livre" && s.ativo).map((s) => s.id));
  const vazios = reuniao.livres.filter((l) => ligados.has(l.id) && l.layout === "conteudo" && !l.texto.trim() && !l.imagemId);
  if (vazios.length > 0) {
    out.push({
      id: "vazios",
      nivel: "atencao",
      texto: vazios.length === 1 ? "1 slide de conteúdo está vazio" : `${vazios.length} slides de conteúdo estão vazios`,
      detalhe: `Escreva o texto ou adicione uma imagem: ${vazios.map((l) => l.titulo || "sem título").join(", ")}.`,
    });
  }
  return out;
}

/** Períodos de apuração do ano (slide de regras), a partir do calendário de premiação. */
export function periodosDeApuracao(
  trimestres: readonly { nome: string; inicio: string; fim: string }[],
  ano: string,
  hoje: string,
): PeriodoApuracao[] {
  return trimestres
    .filter((t) => t.inicio.startsWith(ano) || t.fim.startsWith(ano))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 4)
    .map((t) => ({
      nome: t.nome,
      intervalo: intervaloDeMeses(t.inicio, t.fim).replace(/[()]/g, ""),
      situacao: hoje > t.fim ? "fechado" : hoje >= t.inicio ? "andamento" : "proximo",
    }));
}

// ---------- sorteio ----------

/** Escolhe um entre os elegíveis com o número aleatório dado (em [0, 1)). */
export function sortearEntre<T>(elegiveis: readonly T[], aleatorio: () => number): T | null {
  if (elegiveis.length === 0) return null;
  const i = Math.min(elegiveis.length - 1, Math.floor(aleatorio() * elegiveis.length));
  return elegiveis[i];
}

// ---------- resumo para os atletas ----------

const ORDINAL = ["1º", "2º", "3º"];

/**
 * Texto da notícia "Resultados do período" para mandar aos atletas depois da
 * reunião: números das equipes, pódio, destaques e desafios. Só texto (a notícia
 * não leva anexo); o PDF continua sendo baixado à parte.
 */
export function resumoParaAtletas(params: {
  periodo: { nome: string };
  corrida: ResultadoEquipe;
  bicicleta: ResultadoEquipe;
  destaques?: readonly Destaque[];
  desafios?: readonly DesafioConcluido[];
  novos?: number;
  /** O período ainda não terminou: os números são parciais. */
  parcial?: boolean;
}): { titulo: string; resumo: string; corpo: string } {
  const { periodo, corrida, bicicleta } = params;
  const equipes = [corrida, bicicleta].filter((e) => e.totais.treinos > 0);
  const treinos = corrida.totais.treinos + bicicleta.totais.treinos;
  const km = corrida.totais.km + bicicleta.totais.km;
  const titulo = `Resultados do ${periodo.nome}`;
  const resumo =
    treinos > 0
      ? `Juntos, somamos ${plural(treinos, "treino")} e ${formatKmTotal(km)}${params.parcial ? " até agora" : ""}. Veja o pódio e os destaques do período.`
      : `Os resultados do ${periodo.nome} já estão no ranking do portal.`;

  const blocos: string[] = [];
  for (const e of equipes) {
    const linhas = [
      modalidadeLabel[e.modalidade],
      `${plural(e.totais.atletas, "atleta")} · ${plural(e.totais.treinos, "treino")} · ${formatKmTotal(e.totais.km)}`,
    ];
    for (const d of e.podio.slice(0, 3)) {
      const nomes = d.atletas.map((a) => a.nome).join(", ");
      const extra = d.total > d.atletas.length ? ` e mais ${d.total - d.atletas.length}` : "";
      const pontos = d.atletas[0] ? ` (${formatPontos(d.atletas[0].pontos)} pts)` : "";
      linhas.push(`${ORDINAL[d.posicao - 1] ?? `${d.posicao}º`} ${nomes}${extra}${pontos}`);
    }
    blocos.push(linhas.join("\n"));
  }

  const destaques = params.destaques ?? [];
  if (destaques.length) {
    blocos.push(["Destaques", ...destaques.map((d) => `${d.titulo}: ${d.atleta.nome}, ${d.valor} ${d.unidade}`)].join("\n"));
  }
  const desafios = (params.desafios ?? []).filter((d) => d.participantes > 0);
  if (desafios.length) {
    blocos.push(
      ["Desafios", ...desafios.map((d) => `${d.titulo}: ${d.concluidos} de ${plural(d.participantes, "participante")} ${d.concluidos === 1 ? "concluiu" : "concluíram"}`)].join("\n"),
    );
  }
  if (params.novos) blocos.push(`Boas-vindas ${params.novos === 1 ? "ao atleta novo" : `aos ${params.novos} atletas novos`} que chegaram no período.`);
  blocos.push(params.parcial ? "O período ainda está em andamento: siga registrando seus treinos." : "Obrigado a todos que treinaram e registraram. Bora para o próximo!");

  return { titulo, resumo, corpo: blocos.join("\n\n") };
}
