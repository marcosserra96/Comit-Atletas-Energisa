"use client";

import { FormEvent, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { HistoricoPontoDoc } from "@/lib/types";
import { formatPontos, plural } from "@/lib/format";

/** Estornar um lançamento ou vários de uma vez (o lançamento inteiro). O motivo vai para a auditoria. */
export function EstornarModal({
  itens,
  onClose,
  onConfirm,
}: {
  itens: HistoricoPontoDoc[] | null;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const idMotivo = useId();
  const validos = (itens ?? []).filter((l) => !l.estornado);
  const pontos = validos.reduce((s, l) => s + l.pontos, 0);
  const atletas = new Set(validos.map((l) => l.atletaId)).size;
  const um = validos.length === 1 ? validos[0] : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(motivo.trim());
      setMotivo("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={!!itens}
      onClose={onClose}
      mobileSheet
      title={um ? "Estornar lançamento" : `Estornar ${plural(validos.length, "lançamento")}`}
      description={
        um
          ? `Tira ${formatPontos(um.pontos)} pts de ${um.atletaNome} (${um.regraDesc}). Se for só um dado errado, use Editar.`
          : `Tira ${formatPontos(pontos)} pts de ${plural(atletas, "atleta")}${validos[0]?.descricaoLote ? ` no lançamento "${validos[0].descricaoLote}"` : ""}. Se for só a data ou a descrição, use Editar lançamento.`
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idMotivo} className="text-sm font-medium text-text">
            Motivo <span className="font-normal text-text-muted">(fica na auditoria)</span>
          </label>
          <textarea
            id={idMotivo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            minLength={5}
            rows={3}
            placeholder="Ex: lançamento duplicado por engano"
            className="w-full rounded-[var(--radius)] border border-border bg-bg-card px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            Confirmar estorno
          </Button>
        </div>
      </form>
    </Modal>
  );
}
