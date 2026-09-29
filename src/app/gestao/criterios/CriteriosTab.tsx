"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { NovaRegraModal } from "./NovaRegraModal";
import type { RegraPontuacaoDoc } from "@/lib/types";
import { formatPontos } from "@/lib/format";

const modalidadeLabel: Record<RegraPontuacaoDoc["modalidade"], string> = {
  ambas: "Corrida e Bike",
  corrida: "Corrida",
  bicicleta: "Bike",
};

export function CriteriosTab() {
  const { show } = useToast();
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<RegraPontuacaoDoc | null>(null);
  const [excluindo, setExcluindo] = useState<RegraPontuacaoDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regras_pontuacao"), (snap) => {
      setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc));
    });
    return unsubscribe;
  }, []);

  async function handleExcluir() {
    if (!excluindo) return;
    try {
      await deleteDoc(doc(db, "regras_pontuacao", excluindo.id));
      setExcluindo(null);
      show("success", "Regra removida.");
    } catch {
      show("error", "Não foi possível remover agora. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Critérios de pontuação</h1>
          <p className="text-sm text-text-light">
            Defina as regras usadas para pontuar treinos, eventos e lançamentos avulsos.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nova regra
        </Button>
      </div>

      {regras === null ? (
        <Card className="h-40 animate-pulse" />
      ) : regras.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Nenhuma regra cadastrada"
            description="Clique em 'Nova regra' para definir os critérios de pontuação."
          />
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {regras.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 pl-4 pr-2 sm:pl-5">
                <div className="min-w-0 flex-1 py-1">
                  <p className="font-medium text-text">{r.descricao}</p>
                  <p className="mt-0.5 text-xs text-text-light">{modalidadeLabel[r.modalidade]}</p>
                </div>
                <span className="shrink-0 text-base font-bold tabular-nums text-text">
                  {formatPontos(r.pontos)}
                  <span className="ml-0.5 text-xs font-medium text-text-muted">pts</span>
                </span>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(r);
                      setModalOpen(true);
                    }}
                    aria-label={`Editar “${r.descricao}”`}
                    className="flex size-11 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcluindo(r)}
                    aria-label={`Excluir “${r.descricao}”`}
                    className="flex size-11 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmActionModal
        open={!!excluindo}
        title="Excluir regra"
        description={`A regra “${excluindo?.descricao ?? ""}” será removida. Lançamentos já registrados serão preservados.`}
        onClose={() => setExcluindo(null)}
        onConfirm={handleExcluir}
      />
      <NovaRegraModal
        key={editando?.id ?? "nova"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        regra={editando}
        todasRegras={regras ?? []}
      />
    </div>
  );
}
