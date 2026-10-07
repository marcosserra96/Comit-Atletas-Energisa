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
import type { AtletaDoc, EventoDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade, RegraPontuacaoDoc } from "@/lib/types";

// ---------- configuração salva da reunião ----------

export type TipoSecao =
  | "capa"
  | "presenca"
  | "novos"
  | "regras"
  | "resultados"
  | "premiacao"
  | "agenda"
  | "app"
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
  atualizadoEm?: string | null;
  atualizadoPorNome?: string | null;
}

export const TITULO_SECAO: Record<Exclude<TipoSecao, "livre">, { titulo: string; dica: string }> = {
  capa: { titulo: "Capa", dica: "Resultados do ano e o período" },
  presenca: { titulo: "Registre sua presença", dica: "QR code da reunião, ao vivo" },
  novos: { titulo: "Boas-vindas aos novos atletas", dica: "Quem entrou nas equipes no período" },
  regras: { titulo: "Regras de pontuação", dica: "Critérios cadastrados e períodos de apuração" },
  resultados: { titulo: "Resultados totais", dica: "Atletas, treinos, pontos e km" },
  premiacao: { titulo: "Premiação", dica: "Pódio e classificação de cada equipe" },
  agenda: { titulo: "Agenda", dica: "Programação de eventos do ano" },
  app: { titulo: "Aplicativo", dica: "QR code para instalar o app" },
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
      s("livre", combinados.id),
      s("regras"),
      s("resultados"),
      s("premiacao"),
      s("agenda"),
      s("livre", avisos.id),
      s("app"),
      s("obrigado"),
    ],
    livres: [diretoria, combinados, avisos],
    novosIncluir: [],
    novosExcluir: [],
  };
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
  const tipos = new Set<TipoSecao>(["capa", "presenca", "novos", "regras", "resultados", "premiacao", "agenda", "app", "obrigado", "livre"]);
  const livres = (Array.isArray(e.livres) ? e.livres : []).slice(0, 30).map((l) => ({
    id: texto(l?.id, 40) || novoId("l"),
    layout: l?.layout === "divisoria" ? ("divisoria" as const) : ("conteudo" as const),
    titulo: texto(l?.titulo, 120),
    sobretitulo: texto(l?.sobretitulo, 60),
    texto: texto(l?.texto, 1500),
    imagemId: typeof l?.imagemId === "string" && l.imagemId.length < 60 ? l.imagemId : null,
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

/** Tabela de classificação em slides: até `porColuna` linhas e `colunas` colunas por slide. */
export function paginarClassificacao<T>(linhas: readonly T[], porColuna = 15, colunas = 3): T[][][] {
  const porSlide = porColuna * colunas;
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

export type SlideDef =
  | { chave: string; tipo: "capa"; ano: string; meses: string }
  | { chave: string; tipo: "presenca"; evento: { id: string; titulo: string; horario: string } | null; pontos: number | null }
  | { chave: string; tipo: "divisoria"; sobretitulo: string; titulo: string; subtitulo: string; fundo: FundoDivisoria }
  | { chave: string; tipo: "novos"; atletas: NovoAtletaSlide[]; pagina: number; paginas: number }
  | { chave: string; tipo: "conteudo"; titulo: string; texto: string; imagemId: string | null }
  | { chave: string; tipo: "regras"; regras: LinhaRegra[]; periodos: PeriodoApuracao[] }
  | { chave: string; tipo: "totais"; titulo: string; periodo: string; corrida: ResultadoEquipe["totais"]; bicicleta: ResultadoEquipe["totais"] }
  | { chave: string; tipo: "podio"; modalidade: Modalidade; periodo: string; podio: ResultadoEquipe["podio"] }
  | { chave: string; tipo: "classificacao"; modalidade: Modalidade; periodo: string; colunas: LinhaResultado[][]; pagina: number; paginas: number; temNovos: boolean }
  | { chave: string; tipo: "agenda"; ano: string; colunas: ColunaAgenda[] }
  | { chave: string; tipo: "app" }
  | { chave: string; tipo: "obrigado" };

export const NOVOS_POR_SLIDE = 10;

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
          slides.push({ chave: k, tipo: "divisoria", sobretitulo: l.sobretitulo, titulo: l.titulo, subtitulo: l.texto, fundo: "divisoria" });
        } else {
          slides.push({ chave: k, tipo: "conteudo", titulo: l.titulo, texto: l.texto, imagemId: l.imagemId });
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
        slides.push({ chave: k, tipo: "totais", titulo: "Resultados totais", periodo: rotuloPeriodo, corrida: params.corrida.totais, bicicleta: params.bicicleta.totais });
        break;
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
      case "obrigado":
        slides.push({ chave: k, tipo: "obrigado" });
        break;
    }
  }
  return slides;
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
