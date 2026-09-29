"use client";

import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Bike, CalendarX2, Footprints, Plus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import {
  NOMES_DIAS,
  ORDEM_DIAS,
  descreverDias,
  type AgendaTreinoModalidade,
  type DiaDaSemana,
  type DiasTreinoConfigDoc,
} from "@/lib/aderencia";
import type { Modalidade } from "@/lib/types";

const MODALIDADES: { chave: Modalidade; nome: string; icone: typeof Bike; cor: string }[] = [
  { chave: "corrida", nome: "Corrida", icone: Footprints, cor: "bg-sport-running-subtle text-sport-running" },
  { chave: "bicicleta", nome: "Bike", icone: Bike, cor: "bg-sport-cycling-subtle text-sport-cycling" },
];

function LinhaModalidade({
  nome,
  icone: Icone,
  cor,
  agenda,
  onChange,
}: {
  nome: string;
  icone: typeof Bike;
  cor: string;
  agenda: AgendaTreinoModalidade;
  onChange: (agenda: AgendaTreinoModalidade) => void;
}) {
  function alternar(dia: DiaDaSemana) {
    const dias = agenda.dias.includes(dia) ? agenda.dias.filter((d) => d !== dia) : [...agenda.dias, dia];
    onChange({ ...agenda, dias });
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-40 items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-[var(--radius)]", cor)}>
          <Icone className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <p className="font-bold text-text">{nome}</p>
          <p className="text-xs text-text-light">{descreverDias(agenda.dias)}</p>
        </div>
      </div>
      <div role="group" aria-label={`Dias de treino de ${nome}`} className="grid grid-cols-7 gap-1.5 md:flex">
        {ORDEM_DIAS.map((dia) => {
          const ativo = agenda.dias.includes(dia);
          return (
            <button
              key={dia}
              type="button"
              aria-pressed={ativo}
              aria-label={NOMES_DIAS[dia].longo}
              onClick={() => alternar(dia)}
              className={cn(
                "flex h-11 min-w-11 items-center justify-center rounded-[var(--radius)] border text-sm font-bold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96]",
                ativo
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border bg-bg-card text-text-light hover:border-border-strong hover:text-text",
              )}
            >
              {NOMES_DIAS[dia].curto}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1 md:ml-auto">
        <span className="text-xs font-semibold text-text-light">Valendo desde</span>
        <input
          type="date"
          value={agenda.desde ?? ""}
          onChange={(e) => onChange({ ...agenda, desde: e.target.value || null })}
          className="h-11 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
        />
      </label>
    </div>
  );
}

/**
 * Agenda oficial de treinos por modalidade. É a base da aderência: treinos
 * feitos ÷ treinos previstos nesses dias.
 */
export function DiasTreinoCard({ config, podeEditar }: { config: DiasTreinoConfigDoc; podeEditar: boolean }) {
  const { atleta } = useActiveSession();
  const { show } = useToast();
  const [rascunho, setRascunho] = useState(config);
  const [base, setBase] = useState(config);
  const [novaData, setNovaData] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Se a configuração mudar em outro lugar e não houver edição pendente, acompanha.
  if (config !== base) {
    setBase(config);
    if (JSON.stringify(rascunho) === JSON.stringify(base)) setRascunho(config);
  }
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(base);

  function adicionarData() {
    if (!novaData || rascunho.semTreino.includes(novaData)) return;
    setRascunho({ ...rascunho, semTreino: [...rascunho.semTreino, novaData].sort() });
    setNovaData("");
  }

  async function salvar() {
    setSalvando(true);
    try {
      await setDoc(doc(db, "configuracoes", "dias_treino"), {
        corrida: { dias: rascunho.corrida.dias, desde: rascunho.corrida.desde ?? null },
        bicicleta: { dias: rascunho.bicicleta.dias, desde: rascunho.bicicleta.desde ?? null },
        semTreino: rascunho.semTreino,
        atualizadoEm: serverTimestamp(),
        atualizadoPorNome: atleta.nome,
      });
      show("success", "Dias de treino salvos. A aderência já usa a nova agenda.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-text">Dias de treino</h2>
        <p className="mt-0.5 text-sm text-text-light">
          Base da aderência: treinos feitos ÷ treinos previstos nestes dias. Faltas justificadas não contam contra o
          atleta.
        </p>
      </div>

      <fieldset disabled={!podeEditar} className="divide-y divide-border disabled:opacity-70">
        {MODALIDADES.map((m) => (
          <LinhaModalidade
            key={m.chave}
            nome={m.nome}
            icone={m.icone}
            cor={m.cor}
            agenda={rascunho[m.chave]}
            onChange={(agenda) => setRascunho({ ...rascunho, [m.chave]: agenda })}
          />
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <CalendarX2 className="size-4 text-text-muted" aria-hidden="true" />
          <h3 className="text-sm font-bold text-text">Datas sem treino</h3>
        </div>
        <p className="text-xs text-text-light">Feriados e treinos cancelados. Valem para as duas modalidades.</p>
        <div className="flex flex-wrap items-center gap-2">
          {rascunho.semTreino.map((data) => (
            <span
              key={data}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-bg-subtle pl-3 pr-1 text-sm font-medium text-text"
            >
              {formatShortDate(data)}
              {podeEditar ? (
                <button
                  type="button"
                  onClick={() => setRascunho({ ...rascunho, semTreino: rascunho.semTreino.filter((d) => d !== data) })}
                  aria-label={`Remover ${formatShortDate(data)}`}
                  className="flex size-7 items-center justify-center rounded-full text-text-muted hover:bg-bg hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </span>
          ))}
          {podeEditar ? (
            <span className="inline-flex items-center gap-1.5">
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                aria-label="Nova data sem treino"
                className="h-9 rounded-[var(--radius)] border border-border bg-bg-card px-2.5 text-base text-text outline-none focus:border-primary sm:text-sm"
              />
              <Button type="button" size="sm" variant="secondary" onClick={adicionarData} disabled={!novaData}>
                <Plus className="size-3.5" />
                Adicionar
              </Button>
            </span>
          ) : null}
          {!podeEditar && rascunho.semTreino.length === 0 ? (
            <span className="text-sm text-text-muted">Nenhuma</span>
          ) : null}
        </div>
      </div>

      {podeEditar ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          {alterado ? <span className="text-xs text-text-light">Alterações não salvas</span> : null}
          <Button type="button" variant="ghost" disabled={!alterado || salvando} onClick={() => setRascunho(base)}>
            Descartar
          </Button>
          <Button type="button" onClick={salvar} loading={salvando} disabled={!alterado}>
            Salvar dias de treino
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
