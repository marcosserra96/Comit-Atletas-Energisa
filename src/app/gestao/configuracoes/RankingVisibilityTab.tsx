"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, Timestamp, writeBatch } from "firebase/firestore";
import { Bike, CalendarClock, Footprints, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { RankingPeriodsCard } from "./RankingPeriodsCard";
import {
  RANKING_VISIBILITY_DEFAULT,
  normalizarRankingVisibility,
} from "@/lib/rankingVisibility";
import type {
  Modalidade,
  RankingVisibilityConfigDoc,
  RankingVisibilityPeriodConfig,
} from "@/lib/types";

function periodoValido(periodo: RankingVisibilityPeriodConfig) {
  return !periodo.ativo || Boolean(periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim);
}

function timestampInicio(data: string) {
  return data ? Timestamp.fromDate(new Date(`${data}T00:00:00`)) : null;
}

function timestampFim(data: string) {
  return data ? Timestamp.fromDate(new Date(`${data}T23:59:59.999`)) : null;
}

function PeriodoModalidadeCard({
  modalidade,
  value,
  onChange,
}: {
  modalidade: Modalidade;
  value: RankingVisibilityPeriodConfig;
  onChange: (value: RankingVisibilityPeriodConfig) => void;
}) {
  const corrida = modalidade === "corrida";
  const Icon = corrida ? Footprints : Bike;
  const label = corrida ? "Corrida" : "Ciclismo";

  function update(next: Partial<RankingVisibilityPeriodConfig>) {
    onChange({ ...value, ...next });
  }

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-text">
            <Icon className="size-4 text-primary" aria-hidden="true" />
            {label}
          </h3>
          <p className="mt-1 text-xs text-text-light">
            Durante o período, atletas desta modalidade não conseguem consultar posições ou pontos.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label={`Programar ocultação do ranking de ${label}`}
          aria-checked={value.ativo}
          onClick={() => update({ ativo: !value.ativo })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            value.ativo ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
              value.ativo ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Início"
          type="date"
          value={value.inicio}
          onChange={(event) => update({ inicio: event.target.value })}
          disabled={!value.ativo}
        />
        <TextField
          label="Fim"
          type="date"
          value={value.fim}
          min={value.inicio || undefined}
          onChange={(event) => update({ fim: event.target.value })}
          disabled={!value.ativo}
          error={value.ativo && value.inicio && value.fim < value.inicio ? "O fim deve ser posterior ao início." : undefined}
        />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`mensagem-${modalidade}`} className="text-sm font-medium text-text">
          Mensagem para os atletas
        </label>
        <textarea
          id={`mensagem-${modalidade}`}
          value={value.mensagem}
          onChange={(event) => update({ mensagem: event.target.value })}
          rows={3}
          maxLength={240}
          disabled={!value.ativo}
          placeholder="Ex.: Ranking temporariamente oculto para fechamento e validação da premiação."
          className="w-full rounded-[var(--radius)] border border-border bg-bg px-3.5 py-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </Card>
  );
}

export function RankingVisibilityTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [config, setConfig] = useState<RankingVisibilityConfigDoc>(RANKING_VISIBILITY_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "configuracoes", "ranking_visibilidade"))
      .then((snap) => {
        setConfig(
          snap.exists()
            ? normalizarRankingVisibility(snap.data() as Partial<RankingVisibilityConfigDoc>)
            : RANKING_VISIBILITY_DEFAULT,
        );
      })
      .catch(() => show("error", "Não foi possível carregar a configuração do ranking."))
      .finally(() => setLoading(false));
  }, [show]);

  function update(modalidade: Modalidade, value: RankingVisibilityPeriodConfig) {
    setConfig((atual) => ({ ...atual, [modalidade]: value }));
  }

  async function handleSalvar() {
    if (!periodoValido(config.corrida) || !periodoValido(config.bicicleta)) {
      show("info", "Preencha datas válidas para todas as modalidades ativadas.");
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "configuracoes", "ranking_visibilidade"), {
        corrida: {
          ...config.corrida,
          inicioEm: timestampInicio(config.corrida.inicio),
          fimEm: timestampFim(config.corrida.fim),
        },
        bicicleta: {
          ...config.bicicleta,
          inicioEm: timestampInicio(config.bicicleta.inicio),
          fimEm: timestampFim(config.bicicleta.fim),
        },
        atualizadoEm: Timestamp.now(),
        atualizadoPor: uid,
      });
      addAuditToBatch(batch, {
        acao: "visibilidade_ranking_atualizada",
        entidade: "configuracoes",
        entidadeId: "ranking_visibilidade",
        dados: {
          corrida: config.corrida,
          bicicleta: config.bicicleta,
        },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      await batch.commit();
      show("success", "Períodos de ocultação do ranking salvos.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="h-72 animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-primary/20 bg-primary-subtle p-4">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-bold text-text">Fechamentos e premiações</h3>
          <p className="mt-1 text-xs text-text-light">
            A ocultação começa e termina automaticamente nas datas informadas. Administradores e Comitê continuam vendo o ranking para conferência.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PeriodoModalidadeCard
          modalidade="corrida"
          value={config.corrida}
          onChange={(value) => update("corrida", value)}
        />
        <PeriodoModalidadeCard
          modalidade="bicicleta"
          value={config.bicicleta}
          onChange={(value) => update("bicicleta", value)}
        />
      </div>

      <RankingPeriodsCard />

      <div className="flex justify-end">
        <Button onClick={handleSalvar} loading={saving}>
          <Save className="size-4" aria-hidden="true" />
          Salvar períodos
        </Button>
      </div>
    </div>
  );
}
