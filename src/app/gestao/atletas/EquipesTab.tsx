"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { logAudit } from "@/lib/audit";
import { GripVertical, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { FichaAtletaModal } from "./ficha/FichaAtletaModal";
import { MotivoMovimentacaoModal } from "./MotivoMovimentacaoModal";
import type { AtletaDoc, Equipe } from "@/lib/types";
import { formatPontos, plural } from "@/lib/format";
import { PainelNumeros } from "@/components/ui/PainelNumeros";
import { ChevronRight } from "lucide-react";

function useAtletasPorEquipe(equipe: Equipe, ordenarPorFila = false) {
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  useEffect(() => {
    const restricoes = ordenarPorFila
      ? [where("equipe", "==", equipe), orderBy("ordemFila", "asc")]
      : [where("equipe", "==", equipe)];
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), ...restricoes),
      (snap) =>
        setAtletas(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
            .filter(perfilAtletaVisivel),
        ),
      () => setAtletas([]),
    );
    return unsubscribe;
  }, [equipe, ordenarPorFila]);
  return atletas;
}

/** Lista numerada (ordem alfabética); toque abre a ficha do atleta. */
function ListaSimples({
  atletas,
  vazio,
  onAbrir,
}: {
  atletas: AtletaDoc[] | null;
  vazio: string;
  onAbrir: (atleta: AtletaDoc) => void;
}) {
  if (atletas === null) return <div className="h-32 animate-pulse rounded-[var(--radius)] bg-bg" />;
  if (atletas.length === 0) {
    return (
      <div className="py-6">
        <EmptyState icon={Users} title="Ninguém aqui ainda" description={vazio} />
      </div>
    );
  }
  const ordenados = [...atletas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <ul className="flex flex-col">
      {ordenados.map((a, i) => (
        <li key={a.id} className="border-b border-border last:border-0">
          <button
            type="button"
            onClick={() => onAbrir(a)}
            className="group flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold tabular-nums text-text-light">
              {i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", a.ativo ? "text-text" : "text-text-muted")}>
              {a.nome}
            </span>
            {!a.ativo ? (
              <span className="shrink-0 rounded-full bg-bg-inset px-2 py-0.5 text-xs font-semibold text-text-muted">Inativo</span>
            ) : null}
            <span className="shrink-0 text-sm tabular-nums text-text-light">{formatPontos(a.pontuacaoTotal)} pts</span>
            <ChevronRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "12" ou "12 · 2 inativos" — quem está na equipe e quem está parado. */
function contagem(lista: AtletaDoc[] | null) {
  if (lista === null) return { valor: "…", detalhe: undefined as string | undefined, total: null as number | null };
  const inativos = lista.filter((a) => !a.ativo).length;
  return {
    valor: String(lista.length - inativos),
    detalhe: inativos > 0 ? `ativos · ${plural(inativos, "inativo")}` : "ativos",
    total: lista.length,
  };
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
  const [verificandoComentarios, setVerificandoComentarios] = useState<AtletaDoc | null>(null);
  const [motivoAtleta, setMotivoAtleta] = useState<AtletaDoc | null>(null);
  const [fichaAberta, setFichaAberta] = useState<AtletaDoc | null>(null);
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
      // Popup leve pra registrar o motivo da mudança — não é a ficha completa.
      setMotivoAtleta(movido);
    } catch {
      show("error", "Não foi possível reordenar a fila agora. Tente novamente.");
    }
  }

  const nBike = contagem(bike);
  const nCorrida = contagem(corrida);
  const nComite = contagem(comite);
  const nFila = filaBike && filaCorrida ? filaBike.length + filaCorrida.length : null;
  const comNumero = (rotulo: string, n: number | null) => (n === null ? rotulo : `${rotulo} (${n})`);

  return (
    <div className="flex flex-col gap-4">
      <PainelNumeros
        itens={[
          { rotulo: "Bike", valor: nBike.valor, detalhe: nBike.detalhe },
          { rotulo: "Corrida", valor: nCorrida.valor, detalhe: nCorrida.detalhe },
          {
            rotulo: "Fila de espera",
            valor: nFila === null ? "…" : String(nFila),
            detalhe: filaBike && filaCorrida ? `${filaBike.length} bike · ${filaCorrida.length} corrida` : undefined,
          },
          { rotulo: "Comitê", valor: nComite.total === null ? "…" : String(nComite.total), detalhe: "membros" },
        ]}
      />

      <SegmentedControl
        className="max-w-full overflow-x-auto"
        value={tab}
        onChange={setTab}
        options={[
          { value: "fila", label: comNumero("Filas de espera", nFila) },
          { value: "bike", label: comNumero("Bike", nBike.total) },
          { value: "corrida", label: comNumero("Corrida", nCorrida.total) },
          { value: "comite", label: comNumero("Comitê", nComite.total) },
        ]}
      />

      {tab === "fila" && (
        <div className="flex flex-col gap-5">
          <p className="text-xs text-text-light">
            Arraste para reordenar a prioridade de entrada. Quem está na fila ainda não é considerado
            atleta ativo do programa.
          </p>
          <div>
            <h4 className="mb-2 text-sm font-bold text-primary">
              Fila — Bike{filaBike ? <span className="font-semibold text-text-muted"> · {plural(filaBike.length, "pessoa")}</span> : null}
            </h4>
            <Card className="p-0">
              <FilaList
                atletas={filaBike}
                vazio="Nenhum atleta aguardando vaga na Bike."
                onReordenar={handleReordenar}
                onComentar={setVerificandoComentarios}
              />
            </Card>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-bold text-secondary">
              Fila — Corrida{filaCorrida ? <span className="font-semibold text-text-muted"> · {plural(filaCorrida.length, "pessoa")}</span> : null}
            </h4>
            <Card className="p-0">
              <FilaList
                atletas={filaCorrida}
                vazio="Nenhum atleta aguardando vaga na Corrida."
                onReordenar={handleReordenar}
                onComentar={setVerificandoComentarios}
              />
            </Card>
          </div>
        </div>
      )}
      {tab === "bike" && (
        <Card className="p-0">
          <ListaSimples atletas={bike} vazio="Nenhum atleta ativo na Bike ainda." onAbrir={setFichaAberta} />
        </Card>
      )}
      {tab === "corrida" && (
        <Card className="p-0">
          <ListaSimples atletas={corrida} vazio="Nenhum atleta ativo na Corrida ainda." onAbrir={setFichaAberta} />
        </Card>
      )}
      {tab === "comite" && (
        <Card className="p-0">
          <ListaSimples atletas={comite} vazio="Nenhum membro do comitê cadastrado." onAbrir={setFichaAberta} />
        </Card>
      )}

      <FichaAtletaModal atleta={fichaAberta} onClose={() => setFichaAberta(null)} />
      <FichaAtletaModal
        atleta={verificandoComentarios}
        initialTab="comentarios"
        onClose={() => setVerificandoComentarios(null)}
      />
      <MotivoMovimentacaoModal atleta={motivoAtleta} onClose={() => setMotivoAtleta(null)} />
    </div>
  );
}
