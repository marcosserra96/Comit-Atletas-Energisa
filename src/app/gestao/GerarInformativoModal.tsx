"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Mês de referência padrão: o mês fechado anterior — é o que normalmente vira informativo. */
export function mesReferenciaPadrao(hoje = new Date()): { ano: number; mes: number } {
  const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return { ano: anterior.getFullYear(), mes: anterior.getMonth() + 1 };
}

export function labelMes(ano: number, mes: number) {
  return `${MESES[mes - 1]} de ${ano}`;
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
  onGerar: (ano: number, mes: number) => void;
}) {
  const padrao = mesReferenciaPadrao();
  const [ano, setAno] = useState(padrao.ano);
  const [mes, setMes] = useState(padrao.mes);

  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 4 + i);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Informativo do ranking"
      description="Escolha o mês de referência — o PDF é montado só com os lançamentos desse mês."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Mês</label>
            <Select value={String(mes)} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((nome, i) => (
                <option key={nome} value={String(i + 1)}>
                  {nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Ano</label>
            <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={String(a)}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-primary/[0.07] p-3 text-xs text-text-light">
          <CalendarRange className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Vai sair o informativo de <b className="text-text">{labelMes(ano, mes)}</b>. Se vier com pouca
            coisa preenchida, provavelmente ainda não há lançamentos registrados nesse mês.
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={gerando}>
            Cancelar
          </Button>
          <Button onClick={() => onGerar(ano, mes)} loading={gerando}>
            Gerar PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
