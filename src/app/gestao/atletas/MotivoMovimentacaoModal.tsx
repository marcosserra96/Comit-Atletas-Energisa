"use client";

import { FormEvent, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { AtletaDoc } from "@/lib/types";

/**
 * Popup leve pra registrar o motivo de uma mudança de posição na fila —
 * grava em comentarios_atletas (a mesma coleção da aba Comentários da ficha),
 * então o registro aparece depois no histórico completo do atleta.
 */
export function MotivoMovimentacaoModal({ atleta, onClose }: { atleta: AtletaDoc | null; onClose: () => void }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  function handleClose() {
    setTexto("");
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!atleta || !texto.trim()) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, "comentarios_atletas"), {
        atletaId: atleta.id,
        texto: texto.trim(),
        autorNome: autor.nome,
        autorUid: uid,
        criadoEm: serverTimestamp(),
      });
      show("success", "Motivo registrado.");
      handleClose();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={!!atleta}
      onClose={handleClose}
      title="Motivo da mudança de posição"
      description={atleta ? `Por que ${atleta.nome.split(" ")[0]} mudou de posição na fila? (opcional)` : ""}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Ex.: prioridade por tempo de espera, vaga liberada, pedido do atleta…"
          className="w-full rounded-[var(--radius)] border border-border bg-bg p-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={salvando} disabled={!texto.trim()}>
            Registrar motivo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
