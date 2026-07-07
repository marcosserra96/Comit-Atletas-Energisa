"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmarPerigoModal({
  open,
  titulo,
  descricao,
  palavraChave,
  onClose,
  onConfirm,
}: {
  open: boolean;
  titulo: string;
  descricao: string;
  palavraChave: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (valor !== palavraChave) return;
    setLoading(true);
    try {
      await onConfirm();
      setValor("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={titulo} description={descricao}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">
            Digite <span className="font-bold text-danger">{palavraChave}</span> para confirmar
          </label>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-11 rounded-[var(--radius)] border border-border bg-bg px-3.5 text-sm text-text outline-none focus:border-danger focus:bg-bg-card focus:ring-2 focus:ring-danger/15"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" loading={loading} disabled={valor !== palavraChave}>
            Confirmar exclusão
          </Button>
        </div>
      </form>
    </Modal>
  );
}
