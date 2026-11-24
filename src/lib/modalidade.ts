/**
 * Troca de modalidade (Bike ↔ Corrida). O comitê registra a data da troca e,
 * nas apurações, cada ponto, treino e km conta na modalidade em que o atleta
 * estava naquele dia — quem vem da Bike não leva os km da Bike para a Corrida.
 *
 * Como funciona: antes de apurar por modalidade, `separarPorModalidade`
 * divide quem trocou em "fatias", uma por modalidade. A fatia da modalidade
 * atual mantém o id do atleta; a da outra ganha o id `atletaId~modalidade` e
 * leva só os registros feitos nela. Cada fatia sabe as janelas de datas em
 * que valeu, e os cálculos ignoram a fatia fora delas (não aparece com zero).
 *
 * Tudo aqui é puro (datas civis "YYYY-MM-DD").
 */
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

export interface TrocaDeModalidade {
  /** Primeiro dia (YYYY-MM-DD) na nova modalidade. */
  data: string;
  de: Modalidade;
  para: Modalidade;
  registradoPor?: string;
  registradoPorNome?: string;
  /** ISO. */
  registradoEm?: string;
}

/** Datas inclusivas; "" = sem limite. */
export interface Janela {
  inicio: string;
  fim: string;
}

/** Atleta (ou fatia dele) com as janelas em que vale na modalidade da `equipe`. */
export type AtletaNaModalidade = AtletaDoc & {
  /** Fatia de outra modalidade: o id do atleta de verdade. */
  idReal?: string;
  janelas?: Janela[];
};

const SEPARADOR = "~";
const MODALIDADES: readonly Modalidade[] = ["corrida", "bicicleta"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const ehModalidade = (v: unknown): v is Modalidade => v === "corrida" || v === "bicicleta";

/** Id do atleta de verdade (a fatia `id~bicicleta` vira `id`). */
export function idDoAtleta(id: string) {
  const i = id.indexOf(SEPARADOR);
  return i < 0 ? id : id.slice(0, i);
}

export const idDaFatia = (atletaId: string, modalidade: Modalidade) => `${atletaId}${SEPARADOR}${modalidade}`;

/** Fatia de uma modalidade que o atleta já deixou. */
export const ehOutraModalidade = (id: string) => id.includes(SEPARADOR);

/** Trocas válidas, da mais antiga para a mais nova. */
export function trocasDoAtleta(atleta: Pick<AtletaDoc, "trocasModalidade">): TrocaDeModalidade[] {
  return (atleta.trocasModalidade ?? [])
    .filter((t) => t && DATA.test(t.data) && ehModalidade(t.de) && ehModalidade(t.para) && t.de !== t.para)
    .sort((a, b) => a.data.localeCompare(b.data));
}

function diaAnterior(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Os trechos da vida do atleta, cada um numa modalidade. Sem trocas: um trecho só, sem limites. */
export function trechosDeModalidade(atleta: Pick<AtletaDoc, "equipe" | "trocasModalidade">): { modalidade: Modalidade; inicio: string; fim: string }[] {
  const trocas = trocasDoAtleta(atleta);
  if (trocas.length === 0) return ehModalidade(atleta.equipe) ? [{ modalidade: atleta.equipe, inicio: "", fim: "" }] : [];
  const trechos = [{ modalidade: trocas[0].de, inicio: "", fim: diaAnterior(trocas[0].data) }];
  trocas.forEach((t, i) => trechos.push({ modalidade: t.para, inicio: t.data, fim: trocas[i + 1] ? diaAnterior(trocas[i + 1].data) : "" }));
  return trechos;
}

/** Modalidade do atleta num dia. Sem trocas registradas, a equipe atual. */
export function modalidadeNaData(atleta: Pick<AtletaDoc, "equipe" | "trocasModalidade">, data: string): Modalidade | null {
  const trocas = trocasDoAtleta(atleta);
  if (trocas.length === 0) return ehModalidade(atleta.equipe) ? atleta.equipe : null;
  let atual = trocas[0].de;
  for (const t of trocas) {
    if (data >= t.data) atual = t.para;
    else break;
  }
  return atual;
}

/** O resumo mensal (só tem o mês) conta na modalidade do meio do mês. */
export const modalidadeDoMes = (atleta: Pick<AtletaDoc, "equipe" | "trocasModalidade">, competencia: string) => modalidadeNaData(atleta, `${competencia}-15`);

/** A fatia vale em algum dia do período? Sem janelas, vale sempre. Aceita "YYYY-MM" ou "YYYY-MM-DD". */
export function valeNoPeriodo(atleta: { janelas?: readonly Janela[] }, de?: string, ate?: string) {
  if (!atleta.janelas) return true;
  const inicio = de ? (de.length === 7 ? `${de}-01` : de) : "";
  const fim = ate ? (ate.length === 7 ? `${ate}-31` : ate) : "";
  return atleta.janelas.some((j) => (!j.fim || !inicio || j.fim >= inicio) && (!j.inicio || !fim || j.inicio <= fim));
}

/** Os trechos de `de` a `ate` em que a fatia vale (para a aderência só cobrar os dias dela). */
export function recortarNasJanelas(atleta: { janelas?: readonly Janela[] }, de: string, ate: string): { de: string; ate: string }[] {
  if (!atleta.janelas) return [{ de, ate }];
  return atleta.janelas
    .map((j) => ({ de: j.inicio && j.inicio > de ? j.inicio : de, ate: j.fim && j.fim < ate ? j.fim : ate }))
    .filter((t) => t.de <= t.ate);
}

/**
 * Divide quem trocou de modalidade em fatias (ver o topo do arquivo). Quem
 * nunca trocou passa igual. Os lançamentos e resumos de cada fatia passam a
 * apontar para o id dela.
 */
export function separarPorModalidade<A extends AtletaDoc, L extends Pick<HistoricoPontoDoc, "atletaId" | "dataTreino">, R extends Pick<HistoricoMensalDoc, "atletaId" | "competencia">>(dados: {
  atletas: readonly A[];
  lancamentos: readonly L[];
  resumos: readonly R[];
}): { atletas: (A & AtletaNaModalidade)[]; lancamentos: L[]; resumos: R[] } {
  const comTroca = new Map(dados.atletas.filter((a) => trocasDoAtleta(a).length > 0).map((a) => [a.id, a]));
  if (comTroca.size === 0) return { atletas: [...dados.atletas], lancamentos: [...dados.lancamentos], resumos: [...dados.resumos] };

  const atletas = dados.atletas.flatMap((a): (A & AtletaNaModalidade)[] => {
    if (!comTroca.has(a.id)) return [a];
    const trechos = trechosDeModalidade(a);
    return MODALIDADES.flatMap((m) => {
      const janelas = trechos.filter((t) => t.modalidade === m).map(({ inicio, fim }) => ({ inicio, fim }));
      if (m === a.equipe) return [{ ...a, janelas }];
      if (janelas.length === 0) return [];
      // A outra modalidade: não é "novo atleta" de novo nem conta a entrada na equipe.
      return [{ ...a, id: idDaFatia(a.id, m), idReal: a.id, equipe: m, janelas, entrouNaEquipeEm: undefined }];
    });
  });

  const idNaData = (atletaId: string, modalidade: Modalidade | null) => {
    const a = comTroca.get(atletaId);
    if (!a || !modalidade || modalidade === a.equipe) return atletaId;
    return idDaFatia(atletaId, modalidade);
  };
  const lancamentos = dados.lancamentos.map((l) => {
    const a = comTroca.get(l.atletaId);
    if (!a) return l;
    const id = idNaData(l.atletaId, modalidadeNaData(a, l.dataTreino));
    return id === l.atletaId ? l : { ...l, atletaId: id };
  });
  const resumos = dados.resumos.map((r) => {
    const a = comTroca.get(r.atletaId);
    if (!a) return r;
    const id = idNaData(r.atletaId, modalidadeDoMes(a, r.competencia));
    return id === r.atletaId ? r : { ...r, atletaId: id };
  });
  return { atletas, lancamentos, resumos };
}

/**
 * Sugestão para quem trocou antes deste registro existir: os lançamentos
 * guardam a equipe do dia. Se os mais antigos estão noutra modalidade, sugere
 * a troca no primeiro lançamento na modalidade atual depois deles.
 */
export function sugerirTroca(
  atleta: Pick<AtletaDoc, "equipe" | "trocasModalidade">,
  lancamentos: readonly Pick<HistoricoPontoDoc, "equipe" | "dataTreino" | "estornado">[],
): TrocaDeModalidade | null {
  if (!ehModalidade(atleta.equipe) || trocasDoAtleta(atleta).length > 0) return null;
  const lista = lancamentos.filter((l) => !l.estornado && l.dataTreino && ehModalidade(l.equipe)).sort((a, b) => a.dataTreino.localeCompare(b.dataTreino));
  let ultimoNaOutra = -1;
  lista.forEach((l, i) => {
    if (l.equipe !== atleta.equipe) ultimoNaOutra = i;
  });
  if (ultimoNaOutra < 0) return null;
  const de = lista[ultimoNaOutra].equipe as Modalidade;
  const seguinte = lista.slice(ultimoNaOutra + 1).find((l) => l.equipe === atleta.equipe);
  const data = seguinte ? seguinte.dataTreino : proximoDia(lista[ultimoNaOutra].dataTreino);
  return { de, para: atleta.equipe, data };
}

function proximoDia(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Confere uma lista de trocas antes de salvar: datas válidas e em ordem, uma
 * por dia, e a última termina na equipe atual. Devolve a mensagem do problema.
 */
export function problemaNasTrocas(trocas: readonly TrocaDeModalidade[], equipeAtual: AtletaDoc["equipe"]): string | null {
  const ordenadas = [...trocas].sort((a, b) => a.data.localeCompare(b.data));
  for (const t of ordenadas) {
    if (!DATA.test(t.data)) return "Informe a data de cada troca.";
    if (!ehModalidade(t.de) || !ehModalidade(t.para) || t.de === t.para) return "Cada troca precisa ir de uma modalidade para a outra.";
  }
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].data === ordenadas[i - 1].data) return "Há duas trocas no mesmo dia.";
    if (ordenadas[i].de !== ordenadas[i - 1].para) return "As trocas não se encaixam: cada uma começa na modalidade em que a anterior terminou.";
  }
  const ultima = ordenadas[ordenadas.length - 1];
  if (ultima && ehModalidade(equipeAtual) && ultima.para !== equipeAtual) return "A última troca precisa terminar na equipe atual do atleta.";
  return null;
}
