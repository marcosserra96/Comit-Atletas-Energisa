/**
 * Conquistas do atleta: medalhas, sequência de semanas treinando, quanto falta
 * para subir no ranking e números da equipe. Tudo puro (sem Firebase): roda no
 * celular do atleta e no servidor (para avisar quando uma medalha sai).
 */
import { consolidarAtividades, type RegrasDeTreino } from "@/lib/activityConsolidation";
import type { HistoricoPontoDoc, Modalidade } from "@/lib/types";

// ---------- medalhas ----------

export type NivelMedalha = 1 | 2 | 3 | 4 | 5;
export type IconeMedalha = "treino" | "km" | "chama" | "recorde" | "prova" | "reuniao" | "podio" | "coroa";

export interface DefinicaoMedalha {
  id: string;
  titulo: string;
  /** Como conquistar (aparece na medalha bloqueada). */
  descricao: string;
  icone: IconeMedalha;
  nivel: NivelMedalha;
  grupo: "treinos" | "distancia" | "constancia" | "especiais";
  /** Medalhas que só o servidor registra (dependem do ranking daquele momento). */
  doServidor?: boolean;
}

const TREINOS = [1, 10, 25, 50, 100] as const;
const KM: Record<Modalidade, readonly number[]> = {
  corrida: [50, 100, 250, 500, 1000],
  bicicleta: [250, 500, 1000, 2500, 5000],
};
const SEQUENCIAS = [4, 8, 12] as const;

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function medalhasDaModalidade(modalidade: Modalidade): DefinicaoMedalha[] {
  return [
    ...TREINOS.map((n, i) => ({
      id: `treinos_${n}`,
      titulo: n === 1 ? "Primeiro treino" : `${n} treinos`,
      descricao: n === 1 ? "Faça seu primeiro treino no programa." : `Complete ${n} treinos.`,
      icone: "treino" as const,
      nivel: (i + 1) as NivelMedalha,
      grupo: "treinos" as const,
    })),
    ...KM[modalidade].map((n, i) => ({
      id: `km_${n}`,
      titulo: `${fmt(n)} km`,
      descricao: `Some ${fmt(n)} km nos treinos e provas.`,
      icone: "km" as const,
      nivel: (i + 1) as NivelMedalha,
      grupo: "distancia" as const,
    })),
    ...SEQUENCIAS.map((n, i) => ({
      id: `sequencia_${n}`,
      titulo: `${n} semanas seguidas`,
      descricao: `Treine ${n} semanas seguidas (semana justificada não quebra).`,
      icone: "chama" as const,
      nivel: (i + 2) as NivelMedalha,
      grupo: "constancia" as const,
    })),
    { id: "prova", titulo: "Dia de prova", descricao: "Complete uma prova oficial do programa.", icone: "prova", nivel: 2, grupo: "especiais" },
    { id: "provas_5", titulo: "Rodado em provas", descricao: "Complete 5 provas oficiais.", icone: "prova", nivel: 4, grupo: "especiais" },
    { id: "recorde", titulo: "Recordista", descricao: "Bata um recorde pessoal registrado pelo comitê.", icone: "recorde", nivel: 3, grupo: "especiais" },
    { id: "reunioes_3", titulo: "Presença garantida", descricao: "Esteja presente em 3 reuniões do programa.", icone: "reuniao", nivel: 2, grupo: "especiais" },
    { id: "podio", titulo: "No pódio", descricao: "Fique entre os 3 primeiros no ranking do trimestre.", icone: "podio", nivel: 4, grupo: "especiais", doServidor: true },
    { id: "lider", titulo: "Líder", descricao: "Assuma a liderança do ranking do trimestre.", icone: "coroa", nivel: 5, grupo: "especiais", doServidor: true },
  ];
}

export interface MedalhaDoAtleta extends DefinicaoMedalha {
  conquistada: boolean;
  /** Dia em que conquistou (YYYY-MM-DD), quando dá para saber. */
  em: string | null;
  progresso: { atual: number; meta: number };
}

// ---------- semanas ----------

/** Segunda-feira (YYYY-MM-DD) da semana de uma data. */
export function segundaDaSemana(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

function semanaAnterior(segunda: string) {
  const d = new Date(`${segunda}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

export interface Sequencia {
  /** Semanas seguidas até agora (a semana atual sem treino ainda não quebra). */
  atual: number;
  melhor: number;
  /** Já treinou nesta semana. */
  treinouEstaSemana: boolean;
}

/**
 * Semana "ativa" = pelo menos um treino. Semana com falta justificada fica
 * neutra: não soma e não quebra a sequência.
 */
export function calcularSequencia(lancamentos: readonly HistoricoPontoDoc[], regrasTreino: RegrasDeTreino | undefined, hoje: string): Sequencia {
  const ativas = new Set(
    consolidarAtividades(lancamentos, regrasTreino)
      .filter((a) => a.tipo === "treino" && a.data <= hoje)
      .map((a) => segundaDaSemana(a.data)),
  );
  const justificadas = new Set(
    lancamentos.filter((l) => !l.estornado && l.regraId === "falta_justificada").map((l) => segundaDaSemana(l.dataTreino)),
  );
  const estaSemana = segundaDaSemana(hoje);
  const treinouEstaSemana = ativas.has(estaSemana);

  let atual = 0;
  let semana = treinouEstaSemana ? estaSemana : semanaAnterior(estaSemana);
  for (let guarda = 0; guarda < 520; guarda++) {
    if (ativas.has(semana)) atual += 1;
    else if (!justificadas.has(semana)) break;
    semana = semanaAnterior(semana);
  }

  // Melhor sequência de todo o histórico.
  let melhor = 0;
  if (ativas.size) {
    const ordenadas = [...ativas].sort();
    let corrente = 0;
    let s = ordenadas[0];
    const fim = treinouEstaSemana ? estaSemana : semanaAnterior(estaSemana);
    const passo = (x: string) => {
      const d = new Date(`${x}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7);
      return d.toISOString().slice(0, 10);
    };
    for (let guarda = 0; s <= fim && guarda < 2000; guarda++) {
      if (ativas.has(s)) corrente += 1;
      else if (!justificadas.has(s)) corrente = 0;
      melhor = Math.max(melhor, corrente);
      s = passo(s);
    }
  }
  return { atual, melhor: Math.max(melhor, atual), treinouEstaSemana };
}

// ---------- cálculo das medalhas ----------

/** Dia em que um total acumulado passou da meta (atividades em ordem de data). */
function diaQueAlcancou(itens: { data: string; valor: number }[], meta: number) {
  let soma = 0;
  for (const i of [...itens].sort((a, b) => a.data.localeCompare(b.data))) {
    soma += i.valor;
    if (soma >= meta) return i.data;
  }
  return null;
}

export function calcularMedalhas(params: {
  lancamentos: readonly HistoricoPontoDoc[];
  regrasTreino: RegrasDeTreino | undefined;
  modalidade: Modalidade;
  hoje: string;
  /** Medalhas registradas pelo servidor (pódio, líder): id → dia. */
  doServidor?: Record<string, string>;
}): { medalhas: MedalhaDoAtleta[]; sequencia: Sequencia } {
  const { lancamentos, regrasTreino, modalidade, hoje } = params;
  const atividades = consolidarAtividades(lancamentos, regrasTreino).filter((a) => a.data <= hoje);
  const treinos = atividades.filter((a) => a.tipo === "treino").map((a) => ({ data: a.data, valor: 1 }));
  const km = atividades.filter((a) => a.km > 0).map((a) => ({ data: a.data, valor: a.km }));
  const validos = lancamentos.filter((l) => !l.estornado && l.pontos > 0 && l.dataTreino <= hoje);
  const provas = consolidarAtividades(validos.filter((l) => l.tipoLancamento === "evento"), regrasTreino).map((a) => ({ data: a.data, valor: 1 }));
  const recordes = validos.filter((l) => /recorde/i.test(l.regraDesc)).map((l) => ({ data: l.dataTreino, valor: 1 }));
  const reunioes = validos.filter((l) => l.tipoLancamento === "reuniao").map((l) => ({ data: l.dataTreino, valor: 1 }));
  const sequencia = calcularSequencia(lancamentos, regrasTreino, hoje);
  const totalKm = km.reduce((s, x) => s + x.valor, 0);

  const medalhas = medalhasDaModalidade(modalidade).map((def): MedalhaDoAtleta => {
    const [tipo, numero] = def.id.split("_");
    const meta = Number(numero) || 1;
    let atual = 0;
    let em: string | null = null;
    if (tipo === "treinos") {
      atual = treinos.length;
      em = diaQueAlcancou(treinos, meta);
    } else if (tipo === "km") {
      atual = Math.floor(totalKm);
      em = diaQueAlcancou(km, meta);
    } else if (tipo === "sequencia") {
      atual = sequencia.melhor;
      em = sequencia.melhor >= meta ? "" : null; // o dia exato da sequência não é guardado
    } else if (def.id === "prova" || def.id === "provas_5") {
      atual = provas.length;
      em = diaQueAlcancou(provas, meta);
    } else if (def.id === "recorde") {
      atual = recordes.length;
      em = diaQueAlcancou(recordes, 1);
    } else if (def.id === "reunioes_3") {
      atual = reunioes.length;
      em = diaQueAlcancou(reunioes, meta);
    } else if (def.doServidor) {
      const dia = params.doServidor?.[def.id];
      atual = dia ? 1 : 0;
      em = dia ?? null;
    }
    const conquistada = em !== null;
    return { ...def, conquistada, em: em || null, progresso: { atual: Math.min(atual, meta), meta } };
  });
  return { medalhas, sequencia };
}

/** "18 de 25 treinos", "120 de 250 km". */
export function textoProgresso(m: Pick<MedalhaDoAtleta, "id" | "progresso">) {
  const { atual, meta } = m.progresso;
  const unidade = m.id.startsWith("treinos")
    ? meta === 1 ? "treino" : "treinos"
    : m.id.startsWith("km")
      ? "km"
      : m.id.startsWith("sequencia")
        ? "semanas"
        : m.id.startsWith("prova")
          ? meta === 1 ? "prova" : "provas"
          : m.id.startsWith("reunioes")
            ? "reuniões"
            : "";
  return `${atual.toLocaleString("pt-BR")} de ${meta.toLocaleString("pt-BR")}${unidade ? ` ${unidade}` : ""}`;
}

/** A medalha bloqueada mais perto de sair (maior % de progresso), para o "próxima conquista". */
export function proximaMedalha(medalhas: readonly MedalhaDoAtleta[]) {
  return (
    medalhas
      .filter((m) => !m.conquistada && !m.doServidor && m.progresso.atual > 0)
      .sort((a, b) => b.progresso.atual / b.progresso.meta - a.progresso.atual / a.progresso.meta || a.nivel - b.nivel)[0] ??
    medalhas.find((m) => !m.conquistada && !m.doServidor) ??
    null
  );
}

/** Conquistadas, da mais recente para a mais antiga (sem data vão para o fim). */
export function medalhasRecentes(medalhas: readonly MedalhaDoAtleta[], quantas = 3) {
  return medalhas
    .filter((m) => m.conquistada)
    .sort((a, b) => (b.em ?? "").localeCompare(a.em ?? "") || b.nivel - a.nivel)
    .slice(0, quantas);
}

// ---------- ranking: quanto falta ----------

export type Distancia =
  | { tipo: "lider"; vantagem: number }
  | { tipo: "subir"; posicaoAlvo: number; faltam: number }
  | { tipo: "fora" }
  | null;

/**
 * Quanto falta para subir: até o 3º lugar quem está fora do pódio; até a
 * posição de cima quem já está nele. Empatar já conta como alcançar.
 */
export function distanciaNoRanking(lista: readonly { atletaId: string; pontos: number }[], atletaId: string): Distancia {
  const ordenada = [...lista].filter((l) => l.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  const niveis = [...new Set(ordenada.map((l) => l.pontos))]; // pontos de cada posição (empate denso)
  const meus = ordenada.find((l) => l.atletaId === atletaId)?.pontos ?? 0;
  if (!meus) return niveis.length ? { tipo: "subir", posicaoAlvo: Math.min(3, niveis.length), faltam: niveis[Math.min(3, niveis.length) - 1] } : { tipo: "fora" };
  const posicao = niveis.indexOf(meus) + 1;
  if (posicao === 1) return { tipo: "lider", vantagem: niveis.length > 1 ? meus - niveis[1] : 0 };
  const alvo = posicao > 3 ? 3 : posicao - 1;
  return { tipo: "subir", posicaoAlvo: alvo, faltam: niveis[alvo - 1] - meus };
}

export function textoDistancia(d: Distancia) {
  if (!d) return null;
  if (d.tipo === "lider") return d.vantagem > 0 ? `Você lidera, ${d.vantagem} ${d.vantagem === 1 ? "ponto" : "pontos"} à frente do 2º` : "Você lidera o ranking";
  if (d.tipo === "fora") return null;
  return `Faltam ${d.faltam} ${d.faltam === 1 ? "ponto" : "pontos"} para o ${d.posicaoAlvo}º lugar`;
}

// ---------- equipe ----------

const MARATONA_KM = 42.195;
const VOLTA_AO_MUNDO_KM = 40_075;

/** Comparação que dá para visualizar ("117 maratonas", "12% de uma volta ao mundo"). */
export function equivalenciaDaEquipe(km: number, modalidade: Modalidade) {
  if (km <= 0) return null;
  const volta = km / VOLTA_AO_MUNDO_KM;
  if (volta >= 1) return `${volta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${volta >= 2 ? "voltas" : "volta"} ao mundo`;
  if (modalidade === "corrida") {
    const maratonas = Math.floor(km / MARATONA_KM);
    if (maratonas >= 1) return `${maratonas.toLocaleString("pt-BR")} ${maratonas === 1 ? "maratona" : "maratonas"}`;
  }
  const pct = Math.max(1, Math.round(volta * 100));
  return `${pct}% de uma volta ao mundo`;
}
