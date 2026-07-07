"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NovaRegraModal } from "./NovaRegraModal";
import type { RegraPontuacaoDoc } from "@/lib/types";

const modalidadeLabel: Record<RegraPontuacaoDoc["modalidade"], string> = {
  ambas: "Corrida e Bicicleta",
  corrida: "Corrida",
  bicicleta: "Bicicleta",
};

export function CriteriosTab() {
  const { show } = useToast();
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<RegraPontuacaoDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regras_pontuacao"), (snap) => {
      setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc));
    });
    return unsubscribe;
  }, []);

  async function handleExcluir(regra: RegraPontuacaoDoc) {
    try {
      await deleteDoc(doc(db, "regras_pontuacao", regra.id));
      show("success", "Regra removida.");
    } catch {
      show("error", "Não foi possível remover agora. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="w-fit"
        onClick={() => {
          setEditando(null);
          setModalOpen(true);
        }}
      >
        <Plus className="size-4" />
        Nova regra
      </Button>

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
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-3 py-3 font-semibold">Modalidade</th>
                <th className="px-3 py-3 text-right font-semibold">Pontos</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-text">{r.descricao}</td>
                  <td className="px-3 py-3">
                    <Badge tone="primary">{modalidadeLabel[r.modalidade]}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-text">{r.pontos}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditando(r);
                          setModalOpen(true);
                        }}
                        aria-label="Editar"
                        className="rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-bg hover:text-primary"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => handleExcluir(r)}
                        aria-label="Excluir"
                        className="rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

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
