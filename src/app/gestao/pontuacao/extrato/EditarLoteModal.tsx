"use client";

import { useState } from "react";
import { dataIsoLocal } from "@/lib/date";
import { plural } from "@/lib/format";
import type { LoteExtrato } from "@/lib/extrato";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** Corrige o lançamento inteiro de uma vez: descrição e data do treino. */
export function EditarLoteModal({
  lote,
  onClose,
  onSalvar,
}: {
  lote: LoteExtrato | null;
  onClose: () => void;
  onSalvar: (dados: { descricaoLote: string; dataTreino: string }, motivo: string) => Promise<void>;
}) {
  return (
    <Modal
      open={!!lote}
      onClose={onClose}
      mobileSheet
      title="Editar lançamento"
      description={lote ? `Vale para ${plural(lote.atletas, "atleta")} deste lançamento. Para mudar o critério ou os pontos de alguém, edite a linha da pessoa.` : undefined}
    >
      {lote ? <Formulario key={lote.id} lote={lote} onClose={onClose} onSalvar={onSalvar} /> : null}
    </Modal>
  );
}

function Formulario({
  lote,
  onClose,
  onSalvar,
}: {
  lote: LoteExtrato;
  onClose: () => void;
  onSalvar: (dados: { descricaoLote: string; dataTreino: string }, motivo: string) => Promise<void>;
}) {
  const descricaoAtual = (lote.itens[0]?.descricaoLote ?? "").trim();
  const dataAtual = lote.datas.length === 1 ? lote.datas[0] : "";
  const [descricao, setDescricao] = useState(descricaoAtual);
  const [data, setData] = useState(dataAtual);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const soReuniao = lote.tipo === "reuniao";
  const mudou = (descricao.trim() && descricao.trim() !== descricaoAtual) || (!!data && data !== dataAtual && !soReuniao);
  const dataInvalida = !!data && data > dataIsoLocal();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!mudou || dataInvalida) return;
        setSalvando(true);
        try {
          await onSalvar({ descricaoLote: descricao.trim(), dataTreino: soReuniao ? "" : data }, motivo);
        } finally {
          setSalvando(false);
        }
      }}
    >
      <TextField label="Descrição" value={descricao} maxLength={120} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Treino de sábado" />
      <TextField
        label="Data do treino"
        type="date"
        value={data}
        max={dataIsoLocal()}
        disabled={soReuniao}
        onChange={(e) => setData(e.target.value)}
        error={dataInvalida ? "Escolha uma data até hoje." : undefined}
      />
      {soReuniao ? <p className="-mt-2 text-xs text-text-muted">Presença em reunião segue a data da reunião.</p> : null}
      {lote.datas.length > 1 ? <p className="-mt-2 text-xs text-text-muted">Hoje este lançamento tem datas diferentes. A nova data vale para todos.</p> : null}
      <TextField label="Motivo da correção (opcional)" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: era o treino de domingo" />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={salvando} disabled={!mudou || dataInvalida}>
          Salvar correção
        </Button>
      </div>
    </form>
  );
}
