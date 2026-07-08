import type { AlertaCriterio, AtletaDoc, Equipe, HistoricoPontoDoc } from "@/lib/types";

export interface ResumoAtletaMensal {
  id: string;
  nome: string;
  equipe: Equipe;
  pontosMes: number;
  kmMes: number;
  treinosMes: number;
  ultimaData: string;
}

/** Ranking mensal (só atletas ativos) a partir do histórico completo, filtrado para o mês de referência. */
export function calcularResumoRankingMensal(params: {
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  ano: number;
  mes: number;
}): ResumoAtletaMensal[] {
  const { atletas, lancamentos, ano, mes } = params;
  const prefixoMes = `${ano}-${String(mes).padStart(2, "0")}`;

  const porAtleta = new Map<string, ResumoAtletaMensal>();
  for (const a of atletas) {
    if (!a.ativo) continue;
    porAtleta.set(a.id, { id: a.id, nome: a.nome, equipe: a.equipe, pontosMes: 0, kmMes: 0, treinosMes: 0, ultimaData: "" });
  }

  const participacoes = new Set<string>();
  const kmPorLancamento = new Map<string, number>();

  for (const l of lancamentos) {
    if (l.estornado) continue;
    const item = porAtleta.get(l.atletaId);
    if (!item) continue;
    if (l.dataTreino && l.dataTreino > item.ultimaData) item.ultimaData = l.dataTreino;
    if (!l.dataTreino.startsWith(prefixoMes)) continue;

    item.pontosMes += l.pontos;

    const chaveLancamento = `${l.atletaId}|${l.loteId || [l.eventoId ?? "sem-evento", l.dataTreino, l.regraDesc].join("|")}`;
    participacoes.add(chaveLancamento);
    const km = l.kmPercorrido ?? 0;
    if (!kmPorLancamento.has(chaveLancamento) || km > (kmPorLancamento.get(chaveLancamento) ?? 0)) {
      kmPorLancamento.set(chaveLancamento, km);
    }
  }

  for (const chave of participacoes) {
    const atletaId = chave.split("|")[0];
    const item = porAtleta.get(atletaId);
    if (item) item.treinosMes += 1;
  }
  for (const [chave, km] of kmPorLancamento) {
    const atletaId = chave.split("|")[0];
    const item = porAtleta.get(atletaId);
    if (item) item.kmMes += km;
  }

  return [...porAtleta.values()].sort(ordenarRankingMensal);
}

export function ordenarRankingMensal(a: ResumoAtletaMensal, b: ResumoAtletaMensal) {
  return (
    b.pontosMes - a.pontosMes ||
    b.treinosMes - a.treinosMes ||
    b.kmMes - a.kmMes ||
    a.nome.localeCompare(b.nome)
  );
}

export function atletaEstaEmAlerta(atleta: ResumoAtletaMensal, criterio: AlertaCriterio, valor: number): boolean {
  if (criterio === "ate_x_treinos") return atleta.treinosMes <= valor;
  if (criterio === "ate_x_pontos") return atleta.pontosMes <= valor;
  if (criterio === "sem_treino_30d") {
    if (!atleta.ultimaData) return true;
    const ultima = new Date(`${atleta.ultimaData}T00:00:00`);
    if (Number.isNaN(ultima.getTime())) return true;
    const diffDias = Math.floor((Date.now() - ultima.getTime()) / 86400000);
    return diffDias > valor;
  }
  return atleta.treinosMes <= 0;
}

export function diasUteisNoMes(ano: number, mes: number): number {
  let count = 0;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(ano, mes - 1, dia).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) count++;
  }
  return count;
}
