"use client";

import { useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { logAudit } from "@/lib/audit";
import { equipeLabel } from "@/lib/labels";
import type { AtletaDoc } from "@/lib/types";

export function CorrigirVinculoModal({
  pessoa,
  atletasSemVinculo,
  onClose,
}: {
  pessoa: AtletaDoc | null;
  atletasSemVinculo: AtletaDoc[];
  onClose: () => void;
}) {
  const { uid: adminUid, atleta: adminAtleta } = useActiveSession();
  const { show } = useToast();
  const [novoAtletaId, setNovoAtletaId] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleConfirmar() {
    if (!pessoa?.authUid || !novoAtletaId) return;
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "atletas", pessoa.id), {
        authUid: null,
        email: null,
        role: null,
        atualizadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "atletas", novoAtletaId), {
        authUid: pessoa.authUid,
        email: pessoa.email,
        role: pessoa.role,
        atualizadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "usuarios", pessoa.authUid), {
        atletaId: novoAtletaId,
      });
      await batch.commit();
      await logAudit({
        acao: "corrigir_vinculo_perfil",
        entidade: "usuarios",
        entidadeId: pessoa.authUid,
        dados: { de: pessoa.id, para: novoAtletaId },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show("success", "Vínculo corrigido com sucesso.");
      setNovoAtletaId("");
      onClose();
    } catch {
      show("error", "Não foi possível corrigir o vínculo agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={!!pessoa}
      onClose={onClose}
      title="Corrigir vínculo do perfil"
      description={pessoa ? `Reatribui o login de ${pessoa.nome} para outro cadastro de atleta.` : ""}
    >
      {pessoa && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-[var(--radius)] border border-accent/25 bg-accent/5 p-3.5 text-sm text-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>
              O login de <b>{pessoa.email}</b> deixa de estar vinculado a{" "}
              <b>{pessoa.nome}</b> e passa a acessar o cadastro escolhido abaixo (nome,
              histórico de pontos, equipe — tudo que essa pessoa vir ao entrar). O cadastro
              atual (<b>{pessoa.nome}</b>) fica sem login, disponível para um novo vínculo depois.
            </p>
          </div>

          {atletasSemVinculo.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum cadastro de atleta sem login disponível para reatribuir agora.
            </p>
          ) : (
            <Select
              placeholder="Selecione o cadastro correto"
              value={novoAtletaId}
              onChange={(e) => setNovoAtletaId(e.target.value)}
            >
              {atletasSemVinculo.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} — {equipeLabel[a.equipe]}
                </option>
              ))}
            </Select>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmar}
              loading={salvando}
              disabled={!novoAtletaId}
            >
              Reatribuir vínculo
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
