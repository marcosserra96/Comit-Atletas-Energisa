"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { AlertTriangle, ListFilter, Save, Trophy } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { logAudit } from "@/lib/audit";
import { INFORMATIVO_PADRAO, normalizarInformativoConfig } from "@/lib/informativoConfig";
import type { AlertaCriterio, InformativoConfigDoc } from "@/lib/types";

const CRITERIOS: { value: AlertaCriterio; label: string }[] = [
  { value: "sem_treino_mes", label: "Sem treino no mês" },
  { value: "sem_treino_30d", label: "Sem treino há mais de X dias" },
  { value: "ate_x_treinos", label: "Até X treinos no mês" },
  { value: "ate_x_pontos", label: "Até X pontos no mês" },
];

const TOGGLES: { chave: keyof Pick<InformativoConfigDoc, "mostrarKpis" | "mostrarLegenda" | "mostrarTop3" | "mostrarAlertas" | "mostrarDemais" | "paginasSeparadas">; label: string }[] = [
  { chave: "mostrarKpis", label: "Mostrar KPIs (pontos, km, treinos)" },
  { chave: "mostrarLegenda", label: "Mostrar legenda de cores" },
  { chave: "mostrarTop3", label: "Mostrar top 3 do ranking" },
  { chave: "mostrarAlertas", label: "Mostrar atletas em alerta" },
  { chave: "mostrarDemais", label: "Mostrar demais atletas" },
  { chave: "paginasSeparadas", label: "Bike e Corrida em páginas separadas" },
];

export function InformativoTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [config, setConfig] = useState<InformativoConfigDoc>(INFORMATIVO_PADRAO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "configuracoes", "informativo")).then((snap) => {
      if (snap.exists()) setConfig(normalizarInformativoConfig(snap.data() as Partial<InformativoConfigDoc>));
      setLoading(false);
    });
  }, []);

  function update(next: Partial<InformativoConfigDoc>) {
    setConfig((atual) => ({ ...atual, ...next }));
  }

  async function handleSalvar() {
    setSaving(true);
    try {
      await setDoc(doc(db, "configuracoes", "informativo"), {
        ...config,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: uid,
      });
      await logAudit({
        acao: "padrao_informativo_atualizado",
        entidade: "configuracoes",
        entidadeId: "informativo",
        dados: { ...config },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      show("success", "Padrão do informativo salvo para o portal.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="h-80 animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-text">
            <ListFilter className="size-4 text-text-muted" />
            Filtros e conteúdo
          </h3>
          <p className="mb-4 text-xs text-text-light">
            Define o que aparece por padrão no Informativo do Ranking exportado.
          </p>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Modalidade</label>
              <Select
                value={config.modalidade}
                onChange={(e) => update({ modalidade: e.target.value as InformativoConfigDoc["modalidade"] })}
              >
                <option value="todos">Bike e Corrida</option>
                <option value="bicicleta">Só Bike</option>
                <option value="corrida">Só Corrida</option>
              </Select>
            </div>
            <TextField
              label="Limite de atletas por tabela"
              type="number"
              min={1}
              value={String(config.limite)}
              onChange={(e) => update({ limite: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>

          <div className="flex flex-col gap-2">
            {TOGGLES.map((t) => (
              <label key={t.chave} className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={config[t.chave]}
                  onChange={(e) => update({ [t.chave]: e.target.checked })}
                  className="size-4 rounded border-border accent-primary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-text">
            <AlertTriangle className="size-4 text-text-muted" />
            Critério de alerta
          </h3>
          <p className="mb-4 text-xs text-text-light">
            Define quem entra na faixa &quot;em alerta&quot; (destacado em laranja) do informativo.
          </p>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Critério</label>
              <Select
                value={config.alertaCriterio}
                onChange={(e) => update({ alertaCriterio: e.target.value as AlertaCriterio })}
              >
                {CRITERIOS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <TextField
              label="Valor (X)"
              type="number"
              min={0}
              value={String(config.alertaValor)}
              onChange={(e) => update({ alertaValor: Math.max(0, Number(e.target.value) || 0) })}
              disabled={config.alertaCriterio === "sem_treino_mes"}
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-accent/10 p-3 text-xs text-accent">
            <Trophy className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Top 3 do ranking aparecem em verde; demais atletas em alerta pelo critério acima aparecem em
              laranja no PDF exportado.
            </span>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSalvar} loading={saving}>
          <Save className="size-4" />
          Salvar padrão do informativo
        </Button>
      </div>
    </div>
  );
}
