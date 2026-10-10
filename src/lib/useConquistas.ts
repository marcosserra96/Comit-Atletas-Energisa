"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { calcularMedalhas, medalhasRecentes, proximaMedalha, type MedalhaDoAtleta } from "@/lib/conquistas";
import type { RegrasDeTreino } from "@/lib/activityConsolidation";
import type { AtletaDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

function modalidadeDe(equipe: string): Modalidade | null {
  if (equipe.includes("bicicleta")) return "bicicleta";
  if (equipe.includes("corrida")) return "corrida";
  return null;
}

const chaveVistas = (atletaId: string) => `conquistas-vistas-${atletaId}`;

function lerVistas(atletaId: string): Set<string> | null {
  try {
    const bruto = localStorage.getItem(chaveVistas(atletaId));
    return bruto ? new Set(JSON.parse(bruto) as string[]) : null;
  } catch {
    return null;
  }
}

function gravarVistas(atletaId: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(chaveVistas(atletaId), JSON.stringify([...ids]));
  } catch {
    // Sem armazenamento: a comemoração pode aparecer de novo, sem prejuízo.
  }
}

/**
 * Medalhas e sequência do atleta, a partir dos lançamentos que a tela já
 * carregou, mais o que o servidor registrou (pódio, liderança).
 * `novas`: conquistadas desde a última visita, para a comemoração (só no próprio aparelho).
 */
export function useConquistas(params: {
  atleta: AtletaDoc;
  lancamentos: HistoricoPontoDoc[] | null;
  regrasTreino: RegrasDeTreino | null;
  /** Comitê vendo como o atleta: lê as medalhas dele e não comemora. */
  preview?: boolean;
}) {
  const { atleta, lancamentos, regrasTreino, preview = false } = params;
  const modalidade = modalidadeDe(String(atleta.equipe));
  const [doServidor, setDoServidor] = useState<{ id: string; medalhas: Record<string, string> } | null>(null);
  const [vistasVersao, setVistasVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      const r = await fetch(`/api/conquistas${preview ? `?atletaId=${encodeURIComponent(atleta.id)}` : ""}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const corpo = (await r.json().catch(() => ({}))) as { medalhas?: Record<string, string> };
      if (ativo) setDoServidor({ id: atleta.id, medalhas: r.ok ? (corpo.medalhas ?? {}) : {} });
    })().catch(() => ativo && setDoServidor({ id: atleta.id, medalhas: {} }));
    return () => {
      ativo = false;
    };
  }, [atleta.id, preview]);

  const resultado = useMemo(() => {
    if (!modalidade || !lancamentos || !regrasTreino) return null;
    const servidor = doServidor?.id === atleta.id ? doServidor.medalhas : {};
    return calcularMedalhas({ lancamentos, regrasTreino, modalidade, hoje: dataIsoLocal(), doServidor: servidor });
  }, [modalidade, lancamentos, regrasTreino, doServidor, atleta.id]);

  const prontas = resultado !== null && doServidor?.id === atleta.id;
  const conquistadas = useMemo(() => (resultado ? resultado.medalhas.filter((m) => m.conquistada) : []), [resultado]);

  // Primeira visita: o que já existia conta como visto (sem comemorar medalha antiga).
  useEffect(() => {
    if (!prontas || preview) return;
    // Sem lista ainda, `novas` já sai vazia; aqui só guarda a base.
    if (lerVistas(atleta.id) === null) gravarVistas(atleta.id, conquistadas.map((m) => m.id));
  }, [prontas, preview, atleta.id, conquistadas]);

  const novas: MedalhaDoAtleta[] = useMemo(() => {
    void vistasVersao;
    if (!prontas || preview) return [];
    const vistas = lerVistas(atleta.id);
    if (!vistas) return [];
    return conquistadas.filter((m) => !vistas.has(m.id));
  }, [prontas, preview, atleta.id, conquistadas, vistasVersao]);

  const marcarComoVistas = useCallback(() => {
    const vistas = lerVistas(atleta.id) ?? new Set<string>();
    conquistadas.forEach((m) => vistas.add(m.id));
    gravarVistas(atleta.id, vistas);
    setVistasVersao((v) => v + 1);
  }, [atleta.id, conquistadas]);

  return {
    carregando: !prontas,
    modalidade,
    medalhas: resultado?.medalhas ?? [],
    sequencia: resultado?.sequencia ?? null,
    proxima: resultado ? proximaMedalha(resultado.medalhas) : null,
    recentes: resultado ? medalhasRecentes(resultado.medalhas, 4) : [],
    total: resultado?.medalhas.length ?? 0,
    conquistadas: conquistadas.length,
    novas,
    marcarComoVistas,
  };
}
