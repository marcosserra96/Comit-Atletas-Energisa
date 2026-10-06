"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { calcularPosicoesRanking } from "@/lib/rankingPosition";
import { calcularResultadosRanking, normalizarRankingPeriods } from "@/lib/rankingPeriods";
import { tempoDoPeriodo, type TempoDoPeriodo } from "@/lib/tempoPeriodo";
import { normalizarCalendario, type CalendarioPremiacaoDoc } from "@/lib/calendarioPremiacao";
import type { RegrasDeTreino } from "@/lib/activityConsolidation";
import type {
  AtletaDoc,
  HistoricoMensalDoc,
  HistoricoPontoDoc,
  Modalidade,
  RankingPeriodsConfigDoc,
  RankingResultadoDoc,
} from "@/lib/types";

export interface TrimestreDoAtleta {
  nome: string;
  inicio: string;
  fim: string;
  tempo: TempoDoPeriodo;
  pontos: number;
  treinos: number;
  km: number;
  /** Colocação no ranking publicado; null quando o ranking não está aberto ou sem pontos. */
  posicao: number | null;
  totalNoRanking: number;
  /** Data da premiação, quando o calendário a informa. */
  premiacao: string | null;
}

/**
 * O trimestre configurado pelo comitê (o que vale na premiação). Usa o ranking
 * publicado — o mesmo da tela Ranking — e, se ele estiver fechado para
 * conferência, mostra só os números do próprio atleta, calculados igual.
 *
 * `undefined` carregando · `null` sem trimestre ativo.
 */
export function useTrimestreDoAtleta(params: {
  atleta: AtletaDoc;
  modalidade: Modalidade | null;
  /** Ranking aberto para o atleta (não oculto, não desativado). */
  rankingLiberado: boolean;
  meusLancamentos: HistoricoPontoDoc[] | null;
  historicoMensal: HistoricoMensalDoc[] | null;
  regrasTreino: RegrasDeTreino | null;
}): TrimestreDoAtleta | null | undefined {
  const { atleta, modalidade, rankingLiberado, meusLancamentos, historicoMensal, regrasTreino } = params;
  const [periodos, setPeriodos] = useState<RankingPeriodsConfigDoc | null | undefined>(undefined);
  const [calendario, setCalendario] = useState<CalendarioPremiacaoDoc | null>(null);
  const [publicados, setPublicados] = useState<{ chave: string; lista: RankingResultadoDoc[] | null } | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "configuracoes", "ranking_periodos"),
        (snap) => setPeriodos(snap.exists() ? normalizarRankingPeriods(snap.data() as Partial<RankingPeriodsConfigDoc>) : null),
        () => setPeriodos(null),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        doc(db, "configuracoes", "calendario_premiacao"),
        (snap) => setCalendario(snap.exists() ? normalizarCalendario(snap.data() as Partial<CalendarioPremiacaoDoc>) : null),
        () => setCalendario(null),
      ),
    [],
  );

  const trimestre = periodos?.trimestre.ativo && periodos.trimestre.inicio && periodos.trimestre.fim ? periodos.trimestre : null;
  const geracao = periodos?.geracaoPublicada;
  const chave = trimestre && geracao && modalidade && rankingLiberado ? `${geracao}|${modalidade}` : null;

  useEffect(() => {
    if (!chave || !geracao || !modalidade) return;
    let ativo = true;
    getDocs(
      query(
        collection(db, "ranking_resultados"),
        where("geracaoId", "==", geracao),
        where("periodoId", "==", "trimestre"),
        where("equipe", "==", modalidade),
      ),
    )
      .then((snap) => {
        if (!ativo) return;
        const lista = snap.docs.map((d) => d.data() as RankingResultadoDoc).filter(perfilAtletaVisivel);
        setPublicados({ chave, lista });
      })
      .catch(() => ativo && setPublicados({ chave, lista: null }));
    return () => {
      ativo = false;
    };
  }, [chave, geracao, modalidade]);

  return useMemo(() => {
    if (periodos === undefined) return undefined;
    if (!trimestre || !modalidade) return null;
    const doCalendario = calendario?.ativo
      ? calendario.trimestres.find((t) => t.inicio === trimestre.inicio && t.fim === trimestre.fim)
      : undefined;
    const base = {
      nome: trimestre.nome,
      inicio: trimestre.inicio,
      fim: trimestre.fim,
      tempo: tempoDoPeriodo(trimestre.inicio, trimestre.fim),
      premiacao: doCalendario?.premiacao || null,
    };

    const lista = chave && publicados?.chave === chave ? publicados.lista : null;
    if (chave && publicados?.chave !== chave) return undefined; // ainda buscando o ranking

    if (lista) {
      const ordenada = [...lista].sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal || a.nome.localeCompare(b.nome, "pt-BR"));
      const posicoes = calcularPosicoesRanking(ordenada.map((r) => r.pontuacaoTotal));
      const i = ordenada.findIndex((r) => r.atletaId === atleta.id || r.id === atleta.id);
      const meu = i >= 0 ? ordenada[i] : null;
      return {
        ...base,
        pontos: meu?.pontuacaoTotal ?? 0,
        treinos: meu?.treinos ?? 0,
        km: meu?.km ?? 0,
        posicao: meu && meu.pontuacaoTotal > 0 ? posicoes[i] : null,
        totalNoRanking: ordenada.length,
      };
    }

    // Ranking fechado (ou indisponível): só os números do atleta.
    if (!meusLancamentos || !historicoMensal || !regrasTreino) return undefined;
    const [meu] = calcularResultadosRanking(
      [atleta],
      meusLancamentos,
      "trimestre",
      trimestre.inicio,
      trimestre.fim,
      historicoMensal,
      regrasTreino,
    );
    return {
      ...base,
      pontos: meu?.pontuacaoTotal ?? 0,
      treinos: meu?.treinos ?? 0,
      km: meu?.km ?? 0,
      posicao: null,
      totalNoRanking: 0,
    };
  }, [periodos, calendario, trimestre, modalidade, chave, publicados, atleta, meusLancamentos, historicoMensal, regrasTreino]);
}
