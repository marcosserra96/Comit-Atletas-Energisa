"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { BarChart3, CheckCircle2, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  RANKING_PERIODS_DEFAULT,
  normalizarRankingPeriods,
} from "@/lib/rankingPeriods";
import { recalcularEPublicarRanking } from "@/lib/rankingAutoUpdate";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import type { RankingPeriodsConfigDoc } from "@/lib/types";

function formatarAtualizacao(value: unknown) {
  if (!value) return null;
  let data: Date | null = null;
  if (typeof value === "string") data = new Date(value);
  if (typeof value === "object" && value && "toDate" in value) {
    data = (value as { toDate: () => Date }).toDate();
  }
  if (!data || Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

export function RankingPeriodsCard() {
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
      const resultado = await recalcularEPublicarRanking({
        ...trimestre,
        nome: trimestre.nome.trim(),
      });
      setConfig((atual) => ({
        ...atual,
        trimestre: { ...trimestre, nome: trimestre.nome.trim() },
        geracaoPublicada: resultado.geracaoId,
        rankingAtualizadoEm: resultado.atualizadoEm,
        rankingAtualizacaoModo: "manual",
      }));
      show(
        "success",
        `Ranking publicado com ${resultado.atletas} atletas${trimestre.ativo ? " nos períodos Geral e Trimestre" : ""}.`,
      );
    } catch (error) {
      show(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o ranking. Tente novamente.",
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

      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius)] bg-success-subtle p-3 text-xs text-text-light">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          Pontos, treinos e quilômetros são atualizados automaticamente após lançamentos,
          importações, estornos e exclusões. Use o botão apenas para alterar o período ou forçar
          uma reconstrução completa.
        </span>
      </div>

      <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-xs text-text-muted">
          <span className="block">
            {config.geracaoPublicada
              ? "Há uma versão publicada para os atletas."
              : "Ainda não há resultados consolidados publicados."}
          </span>
          {formatarAtualizacao(config.rankingAtualizadoEm) ? (
            <span className="mt-1 block">
              Última atualização: {formatarAtualizacao(config.rankingAtualizadoEm)}
              {config.rankingAtualizacaoModo === "automatico" ? " · automática" : ""}
            </span>
          ) : null}
        </div>
        <Button onClick={handlePublicar} loading={processing}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Recalcular agora
        </Button>
      </div>
    </Card>
  );
}
