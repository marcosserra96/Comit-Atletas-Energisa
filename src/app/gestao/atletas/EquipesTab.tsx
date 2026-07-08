"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { SubTabs } from "@/components/ui/SubTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { logAudit } from "@/lib/audit";
import { GripVertical, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { FichaAtletaModal } from "./ficha/FichaAtletaModal";
import type { AtletaDoc, Equipe } from "@/lib/types";

function useAtletasPorEquipe(equipe: Equipe, ordenarPorFila = false) {
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  useEffect(() => {
    const restricoes = ordenarPorFila
      ? [where("equipe", "==", equipe), orderBy("ordemFila", "asc")]
      : [where("equipe", "==", equipe)];
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), ...restricoes),
      (snap) => setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setAtletas([]),
    );
    return unsubscribe;
  }, [equipe, ordenarPorFila]);
  return atletas;
}

function ListaSimples({ atletas, vazio }: { atletas: AtletaDoc[] | null; vazio: string }) {
  if (atletas === null) return <div className="h-32 animate-pulse rounded-[var(--radius)] bg-bg" />;
  if (atletas.length === 0) {
    return (
      <div className="py-6">
        <EmptyState icon={Users} title="Ninguém aqui ainda" description={vazio} />
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {atletas.map((a) => (
          <tr key={a.id} className="border-b border-border last:border-0">
            <td className="px-4 py-3 font-medium text-text">{a.nome}</td>
            <td className="px-4 py-3 text-right text-text-light">{a.pontuacaoTotal} pts</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Lista arrastável da fila de espera — a ordem é a prioridade de entrada no programa. */
function FilaList({
  atletas,
  vazio,
  onReordenar,
  onComentar,
}: {
  atletas: AtletaDoc[] | null;
  vazio: string;
  onReordenar: (novaOrdem: AtletaDoc[], movido: AtletaDoc) => void;
  onComentar: (atleta: AtletaDoc) => void;
}) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobreId, setSobreId] = useState<string | null>(null);

  if (atletas === null) return <div className="h-32 animate-pulse rounded-[var(--radius)] bg-bg" />;
  if (atletas.length === 0) {
    return (
      <div className="py-6">
        <EmptyState icon={Users} title="Ninguém aqui ainda" description={vazio} />
      </div>
    );
  }

  function handleDrop(alvoId: string) {
    setSobreId(null);
    if (!arrastandoId || arrastandoId === alvoId || !atletas) {
      setArrastandoId(null);
      return;
    }
    const lista = [...atletas];
    const origemIdx = lista.findIndex((a) => a.id === arrastandoId);
    const destinoIdx = lista.findIndex((a) => a.id === alvoId);
    const [movido] = lista.splice(origemIdx, 1);
    lista.splice(destinoIdx, 0, movido);
    setArrastandoId(null);
    onReordenar(lista, movido);
  }

  return (
    <ul className="flex flex-col">
      {atletas.map((a, i) => (
        <li
          key={a.id}
          draggable
          onDragStart={() => setArrastandoId(a.id)}
          onDragOver={(e) => {
            e.preventDefault();
            if (sobreId !== a.id) setSobreId(a.id);
          }}
          onDragLeave={() => setSobreId((atual) => (atual === a.id ? null : atual))}
          onDrop={() => handleDrop(a.id)}
          onDragEnd={() => {
            setArrastandoId(null);
            setSobreId(null);
          }}
          className={cn(
            "flex cursor-grab items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 active:cursor-grabbing",
            arrastandoId === a.id && "opacity-40",
            sobreId === a.id && arrastandoId !== a.id && "bg-primary/5",
          )}
        >
          <GripVertical className="size-4 shrink-0 text-text-muted" />
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold text-text-light">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{a.nome}</span>
          <button
            type="button"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onComentar(a);
            }}
            title="Ver ou adicionar comentário"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:bg-bg hover:text-primary"
          >
            <MessageSquare className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

type SubTab = "fila" | "bike" | "corrida" | "comite";

export function EquipesTab() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [tab, setTab] = useState<SubTab>("fila");
  const [comentandoAtleta, setComentandoAtleta] = useState<AtletaDoc | null>(null);
  const filaBike = useAtletasPorEquipe("fila_bicicleta", true);
  const filaCorrida = useAtletasPorEquipe("fila_corrida", true);
  const bike = useAtletasPorEquipe("bicicleta");
  const corrida = useAtletasPorEquipe("corrida");
  const comite = useAtletasPorEquipe("comite");

  async function handleReordenar(novaOrdem: AtletaDoc[], movido: AtletaDoc) {
    try {
      const batch = writeBatch(db);
      novaOrdem.forEach((a, i) => {
        batch.update(doc(db, "atletas", a.id), { ordemFila: i });
      });
      await batch.commit();
      await logAudit({
        acao: "reordenar_fila",
        entidade: "atletas",
        entidadeId: novaOrdem[0]?.equipe ?? "fila",
        dados: { ordem: novaOrdem.map((a) => a.nome) },
        criadoPor: uid,
        criadoPorNome: autor.nome,
      });
      // Abre o comentário direto na pessoa que foi movida, pra registrar o motivo na hora.
      setComentandoAtleta(movido);
    } catch {
      show("error", "Não foi possível reordenar a fila agora. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "fila", label: "Filas de espera" },
          { value: "bike", label: "Bicicleta" },
          { value: "corrida", label: "Corrida" },
          { value: "comite", label: "Comitê" },
        ]}
      />

      {tab === "fila" && (
        <div className="flex flex-col gap-5">
          <p className="text-xs text-text-light">
            Arraste para reordenar a prioridade de entrada. Quem está na fila ainda não é considerado
            atleta ativo do programa.
          </p>
          <div>
            <h4 className="mb-2 text-sm font-bold text-primary">Fila — Bicicleta</h4>
            <Card className="p-0">
              <FilaList
                atletas={filaBike}
                vazio="Nenhum atleta aguardando vaga na Bicicleta."
                onReordenar={handleReordenar}
                onComentar={setComentandoAtleta}
              />
            </Card>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-bold text-secondary">Fila — Corrida</h4>
            <Card className="p-0">
              <FilaList
                atletas={filaCorrida}
                vazio="Nenhum atleta aguardando vaga na Corrida."
                onReordenar={handleReordenar}
                onComentar={setComentandoAtleta}
              />
            </Card>
          </div>
        </div>
      )}
      {tab === "bike" && (
        <Card className="p-0">
          <ListaSimples atletas={bike} vazio="Nenhum atleta ativo na Bicicleta ainda." />
        </Card>
      )}
      {tab === "corrida" && (
        <Card className="p-0">
          <ListaSimples atletas={corrida} vazio="Nenhum atleta ativo na Corrida ainda." />
        </Card>
      )}
      {tab === "comite" && (
        <Card className="p-0">
          <ListaSimples atletas={comite} vazio="Nenhum membro do comitê cadastrado." />
        </Card>
      )}

      <FichaAtletaModal
        atleta={comentandoAtleta}
        initialTab="comentarios"
        onClose={() => setComentandoAtleta(null)}
      />
    </div>
  );
}
