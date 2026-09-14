"use client";

import { useState } from "react";
import {
  deleteField,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import type { SolicitacaoAcessoDoc } from "@/lib/types";

export function RejectedRequestCard({
  solicitacao,
}: {
  solicitacao: SolicitacaoAcessoDoc;
}) {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  async function handleReabrir() {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "pendente",
        motivoRecusa: deleteField(),
        atualizadoEm: serverTimestamp(),
      });
      addAuditToBatch(batch, {
        acao: "reabrir_solicitacao_acesso",
        entidade: "solicitacoes_acesso",
        entidadeId: solicitacao.uid,
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      await batch.commit();
      show("success", "Solicitação reaberta para análise.");
    } catch {
      show("error", "Não foi possível reabrir a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExcluir() {
    const batch = writeBatch(db);
    batch.delete(doc(db, "solicitacoes_acesso", solicitacao.uid));
    addAuditToBatch(batch, {
      acao: "excluir_solicitacao_acesso",
      entidade: "solicitacoes_acesso",
      entidadeId: solicitacao.uid,
      dados: { email: solicitacao.email },
      criadoPor: uid,
      criadoPorNome: atleta.nome,
    });
    await batch.commit();
    setConfirmandoExclusao(false);
    show("success", "Solicitação removida. A pessoa poderá solicitar acesso novamente.");
  }

  return (
    <>
      <Card className="flex flex-col gap-3 border-danger/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-text">{solicitacao.nome}</p>
          <p className="text-xs text-text-light">{solicitacao.email}</p>
          {solicitacao.motivoRecusa && (
            <p className="mt-1 text-xs text-danger">Motivo: {solicitacao.motivoRecusa}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleReabrir} loading={busy}>
            <RotateCcw className="size-3.5" />
            Reabrir
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setConfirmandoExclusao(true)}
            disabled={busy}
          >
            <Trash2 className="size-3.5" />
            Excluir
          </Button>
        </div>
      </Card>
      <ConfirmActionModal
        open={confirmandoExclusao}
        title="Excluir solicitação"
        description="A solicitação será apagada. A conta poderá enviar um novo pedido de acesso."
        onClose={() => setConfirmandoExclusao(false)}
        onConfirm={handleExcluir}
      />
    </>
  );
}
