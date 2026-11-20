"use client";

import { useState } from "react";
import { CalendarCheck2, Rocket, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { MODELOS_DE_REUNIAO, type ModeloDeReuniao } from "@/lib/reuniaoResultados";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

export interface PeriodoEscolhivel {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  /** O ano inteiro (fechamento). */
  anual: boolean;
}

const ICONES: Record<ModeloDeReuniao, typeof Trophy> = { trimestre: CalendarCheck2, fechamento: Trophy, rapida: Rocket };

function Pergunta({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-text">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{numero}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/**
 * Nova reunião em três perguntas: que tipo, de que período e qual reunião
 * da agenda. A apresentação já sai montada; depois é só ajustar.
 */
export function AssistenteNovaReuniao({
  aberto,
  onFechar,
  periodos,
  periodoTrimestre,
  periodoAno,
  reunioes,
  reuniaoPadrao,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  periodos: PeriodoEscolhivel[];
  /** Sugestões: o último trimestre fechado e o ano atual. */
  periodoTrimestre: string;
  periodoAno: string;
  reunioes: { id: string; titulo: string; data: string }[];
  reuniaoPadrao: string | null;
  onCriar: (modelo: ModeloDeReuniao, periodo: PeriodoEscolhivel, eventoId: string | null) => void;
}) {
  const [modelo, setModelo] = useState<ModeloDeReuniao>("trimestre");
  const [periodoId, setPeriodoId] = useState<string | null>(null);
  const [eventoId, setEventoId] = useState<string | null | undefined>(undefined);
  // Até a pessoa escolher, o período acompanha o tipo (fechamento → o ano).
  const periodo = periodos.find((p) => p.id === (periodoId ?? (modelo === "fechamento" ? periodoAno : periodoTrimestre))) ?? periodos[0];
  const evento = eventoId === undefined ? reuniaoPadrao : eventoId;

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Nova apresentação"
      description="Responda três perguntas e a apresentação já sai montada. Depois é só ajustar o que quiser."
      size="lg"
      mobileSheet
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={() => periodo && onCriar(modelo, periodo, evento ?? null)} disabled={!periodo}>
            <Sparkles className="size-4" aria-hidden="true" />
            Criar apresentação
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Pergunta numero={1} titulo="Que tipo de reunião?">
          <div role="radiogroup" aria-label="Tipo de reunião" className="grid gap-2 sm:grid-cols-3">
            {MODELOS_DE_REUNIAO.map((m) => {
              const Icone = ICONES[m.id];
              const ativo = m.id === modelo;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setModelo(m.id)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[var(--radius)] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    ativo ? "border-primary bg-primary-subtle ring-1 ring-primary" : "border-border hover:border-border-strong hover:bg-bg-inset/50",
                  )}
                >
                  <Icone className={cn("size-5", ativo ? "text-primary" : "text-text-light")} aria-hidden="true" />
                  <span className="text-sm font-bold text-text">{m.titulo}</span>
                  <span className="text-xs leading-snug text-text-light">{m.descricao}</span>
                </button>
              );
            })}
          </div>
        </Pergunta>

        <Pergunta numero={2} titulo="De qual período são os resultados?">
          <Select aria-label="Período dos resultados" value={periodo?.id ?? ""} onChange={(e) => setPeriodoId(e.target.value)}>
            <optgroup label="Trimestres">
              {periodos
                .filter((p) => !p.anual)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {formatShortDate(p.inicio)} a {formatShortDate(p.fim)}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Ano inteiro">
              {periodos
                .filter((p) => p.anual)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {formatShortDate(p.inicio)} a {formatShortDate(p.fim)}
                  </option>
                ))}
            </optgroup>
          </Select>
        </Pergunta>

        <Pergunta numero={3} titulo="Qual reunião da agenda?">
          <Select aria-label="Reunião da agenda" value={evento ?? ""} onChange={(e) => setEventoId(e.target.value || null)}>
            <option value="">Nenhuma (sem QR de presença)</option>
            {reunioes.map((r) => (
              <option key={r.id} value={r.id}>
                {formatShortDate(r.data)} · {r.titulo}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-light">Ela libera o QR Code para os atletas registrarem presença na hora.</p>
        </Pergunta>
      </div>
    </Modal>
  );
}
