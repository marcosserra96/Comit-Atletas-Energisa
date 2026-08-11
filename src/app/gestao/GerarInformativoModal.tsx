"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface PeriodoInformativo {
  /** Competência inicial e final, no formato "YYYY-MM" (iguais quando é um mês só). */
  de: string;
  ate: string;
}

/** Mês de referência padrão: o mês fechado anterior — é o que normalmente vira informativo. */
export function mesReferenciaPadrao(hoje = new Date()): { ano: number; mes: number } {
  const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return { ano: anterior.getFullYear(), mes: anterior.getMonth() + 1 };
}

function competencia(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Rótulo que vai no PDF: "Junho de 2026", "Junho a Agosto de 2026" ou "Nov. de 2025 a Fev. de 2026". */
export function labelPeriodo({ de, ate }: PeriodoInformativo) {
  const [anoDe, mesDe] = de.split("-").map(Number);
  const [anoAte, mesAte] = ate.split("-").map(Number);
  if (de === ate) return `${MESES[mesDe - 1]} de ${anoDe}`;
  if (anoDe === anoAte) return `${MESES[mesDe - 1]} a ${MESES[mesAte - 1]} de ${anoAte}`;
  return `${MESES[mesDe - 1]} de ${anoDe} a ${MESES[mesAte - 1]} de ${anoAte}`;
}

/** Nome do arquivo: "2026-06" ou "2026-06_a_2026-08". */
export function sufixoArquivo({ de, ate }: PeriodoInformativo) {
  return de === ate ? de : `${de}_a_${ate}`;
}

export function GerarInformativoModal({
  open,
  gerando,
  onClose,
  onGerar,
}: {
  open: boolean;
  gerando: boolean;
  onClose: () => void;
  onGerar: (periodo: PeriodoInformativo) => void;
}) {
  const padrao = mesReferenciaPadrao();
  const [modo, setModo] = useState<"mes" | "periodo">("mes");
  const [ano, setAno] = useState(padrao.ano);
  const [mes, setMes] = useState(padrao.mes);
  const [anoFim, setAnoFim] = useState(padrao.ano);
  const [mesFim, setMesFim] = useState(padrao.mes);

  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 4 + i);

  const periodo: PeriodoInformativo =
    modo === "mes"
      ? { de: competencia(ano, mes), ate: competencia(ano, mes) }
      : (() => {
          const a = competencia(ano, mes);
          const b = competencia(anoFim, mesFim);
          return a <= b ? { de: a, ate: b } : { de: b, ate: a };
        })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Informativo do ranking"
      description="Escolha o período — o PDF soma só os lançamentos que caem nele."
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          value={modo}
          onChange={setModo}
          options={[
            { value: "mes", label: "Um mês" },
            { value: "periodo", label: "Período acumulado" },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">{modo === "mes" ? "Mês" : "Mês inicial"}</label>
            <Select value={String(mes)} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((nome, i) => (
                <option key={nome} value={String(i + 1)}>
                  {nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">{modo === "mes" ? "Ano" : "Ano inicial"}</label>
            <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={String(a)}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {modo === "periodo" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Mês final</label>
              <Select value={String(mesFim)} onChange={(e) => setMesFim(Number(e.target.value))}>
                {MESES.map((nome, i) => (
                  <option key={nome} value={String(i + 1)}>
                    {nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Ano final</label>
              <Select value={String(anoFim)} onChange={(e) => setAnoFim(Number(e.target.value))}>
                {anos.map((a) => (
                  <option key={a} value={String(a)}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-primary/[0.07] p-3 text-xs text-text-light">
          <CalendarRange className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Vai sair o informativo de <b className="text-text">{labelPeriodo(periodo)}</b>
            {modo === "periodo" && " — pontos, treinos e km somados de todos os meses do intervalo"}. Se
            vier com pouca coisa preenchida, provavelmente não há lançamentos registrados nesse período.
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={gerando}>
            Cancelar
          </Button>
          <Button onClick={() => onGerar(periodo)} loading={gerando}>
            Gerar PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
