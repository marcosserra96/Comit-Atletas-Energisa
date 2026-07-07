"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { HistoricoPontoDoc } from "@/lib/types";

export function EstornarModal({
  lancamento,
  onClose,
  onConfirm,
}: {
  lancamento: HistoricoPontoDoc | null;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

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
      open={!!lancamento}
      onClose={onClose}
      title="Estornar lançamento"
      description={
        lancamento
          ? `Isso remove ${lancamento.pontos} pts de ${lancamento.atletaNome} referentes a "${lancamento.regraDesc}". Informe o motivo — fica registrado na auditoria.`
          : undefined
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
          minLength={5}
          rows={3}
          placeholder="Ex: lançamento duplicado por engano"
          className="w-full rounded-[var(--radius)] border border-border bg-bg-card px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
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
