"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { BarChart3, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { TAMANHO_LOTE } from "@/lib/pontuacaoImportacao";
import {
  RANKING_PERIODS_DEFAULT,
  calcularResultadosRanking,
  normalizarRankingPeriods,
} from "@/lib/rankingPeriods";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import type {
  AtletaDoc,
  HistoricoPontoDoc,
  RankingPeriodsConfigDoc,
  RankingResultadoDoc,
} from "@/lib/types";

export function RankingPeriodsCard() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [config, setConfig] = useState<RankingPeriodsConfigDoc>(RANKING_PERIODS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "configuracoes", "ranking_periodos"))
      .then((snap) => {
        setConfig(
          snap.exists()
            ? normalizarRankingPeriods(snap.data() as Partial<RankingPeriodsConfigDoc>)
            : RANKING_PERIODS_DEFAULT,
        );
      })
      .catch(() => show("error", "Não foi possível carregar os períodos do ranking."))
      .finally(() => setLoading(false));
  }, [show]);

  function updateTrimestre(next: Partial<RankingPeriodsConfigDoc["trimestre"]>) {
    setConfig((atual) => ({
      ...atual,
      trimestre: { ...atual.trimestre, ...next },
    }));
  }

  async function handlePublicar() {
    const trimestre = config.trimestre;
    if (
      trimestre.ativo &&
      (!trimestre.nome.trim() ||
        !trimestre.inicio ||
        !trimestre.fim ||
        trimestre.inicio > trimestre.fim)
    ) {
      show("info", "Preencha nome, início e fim válidos para o trimestre.");
      return;
    }

    setProcessing(true);
    try {
      const [atletasSnap, historicoSnap, resultadosAntigosSnap] = await Promise.all([
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "historico_pontos")),
        getDocs(collection(db, "ranking_resultados")),
      ]);
      const atletas = atletasSnap.docs.map(
        (item) => ({ id: item.id, ...item.data() }) as AtletaDoc,
      );
      const historico = historicoSnap.docs.map(
        (item) => ({ id: item.id, ...item.data() }) as HistoricoPontoDoc,
      );
      const geracaoId = doc(collection(db, "ranking_resultados")).id;
      const geradoEm = Timestamp.now();
      const geral = calcularResultadosRanking(atletas, historico, "geral");
      const trimestral = trimestre.ativo
        ? calcularResultadosRanking(
            atletas,
            historico,
            "trimestre",
            trimestre.inicio,
            trimestre.fim,
          )
        : [];
      const resultados: RankingResultadoDoc[] = [...geral, ...trimestral].map(
        (resultado) => ({ ...resultado, geracaoId, geradoEm }),
      );

      for (let i = 0; i < resultados.length; i += TAMANHO_LOTE) {
        const batch = writeBatch(db);
        resultados.slice(i, i + TAMANHO_LOTE).forEach((resultado) => {
          batch.set(
            doc(
              db,
              "ranking_resultados",
              `${geracaoId}_${resultado.periodoId}_${resultado.atletaId}`,
            ),
            resultado,
          );
        });
        await batch.commit();
      }

      const finalBatch = writeBatch(db);
      finalBatch.set(doc(db, "configuracoes", "ranking_periodos"), {
        trimestre: {
          ...trimestre,
          nome: trimestre.nome.trim(),
        },
        geracaoPublicada: geracaoId,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: uid,
      });
      addAuditToBatch(finalBatch, {
        acao: "ranking_periodos_publicados",
        entidade: "configuracoes",
        entidadeId: "ranking_periodos",
        dados: {
          trimestre,
          atletas: geral.length,
          resultados: resultados.length,
          geracaoId,
        },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      await finalBatch.commit();

      for (let i = 0; i < resultadosAntigosSnap.docs.length; i += TAMANHO_LOTE) {
        const batch = writeBatch(db);
        resultadosAntigosSnap.docs.slice(i, i + TAMANHO_LOTE).forEach((item) => {
          batch.delete(item.ref);
        });
        await batch.commit();
      }

      setConfig((atual) => ({ ...atual, geracaoPublicada: geracaoId }));
      show(
        "success",
        `Ranking publicado com ${geral.length} atletas${trimestre.ativo ? " nos períodos Geral e Trimestre" : ""}.`,
      );
    } catch {
      show(
        "error",
        "Não foi possível gerar o ranking. Verifique as regras do Firebase e tente novamente.",
      );
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <Card className="h-72 animate-pulse" />;

  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <BarChart3 className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-text">Períodos e resultados publicados</h3>
          <p className="mt-1 text-xs text-text-light">
            O período Geral considera todo o histórico. O trimestre usa exatamente as datas abaixo,
            sem seguir os trimestres do calendário.
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-border bg-bg p-3">
        <strong className="text-sm text-text">Geral</strong>
        <p className="mt-0.5 text-xs text-text-light">
          Sempre disponível e calculado desde o primeiro lançamento.
        </p>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={config.trimestre.ativo}
          onChange={(event) => updateTrimestre({ ativo: event.target.checked })}
          className="mt-0.5 size-4 rounded border-border accent-primary"
        />
        <span>
          Exibir ranking trimestral
          <span className="block text-xs text-text-light">
            Atletas poderão alternar entre o Geral e este período.
          </span>
        </span>
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField
          label="Nome do período"
          value={config.trimestre.nome}
          onChange={(event) => updateTrimestre({ nome: event.target.value })}
          placeholder="Ex.: 3º trimestre"
          disabled={!config.trimestre.ativo}
        />
        <TextField
          label="Início"
          type="date"
          value={config.trimestre.inicio}
          onChange={(event) => updateTrimestre({ inicio: event.target.value })}
          disabled={!config.trimestre.ativo}
        />
        <TextField
          label="Fim"
          type="date"
          min={config.trimestre.inicio || undefined}
          value={config.trimestre.fim}
          onChange={(event) => updateTrimestre({ fim: event.target.value })}
          disabled={!config.trimestre.ativo}
          error={
            config.trimestre.ativo &&
            config.trimestre.inicio &&
            config.trimestre.fim < config.trimestre.inicio
              ? "Data final inválida."
              : undefined
          }
        />
      </div>

      <div className="mt-4 rounded-[var(--radius)] bg-accent/10 p-3 text-xs text-text-light">
        Após novos lançamentos ou estornos, use o botão abaixo para atualizar os pontos, treinos e
        quilômetros que os atletas enxergam. Isso também permite conferir os números antes da
        publicação.
      </div>

      <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <span className="text-xs text-text-muted">
          {config.geracaoPublicada
            ? "Há uma versão publicada para os atletas."
            : "Ainda não há resultados consolidados publicados."}
        </span>
        <Button onClick={handlePublicar} loading={processing}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Recalcular e publicar ranking
        </Button>
      </div>
    </Card>
  );
}
