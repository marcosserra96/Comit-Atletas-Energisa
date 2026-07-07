"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { History, RotateCcw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { logAudit } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { EstornarModal } from "../../pontuacao/EstornarModal";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

export function FichaLancamentosTab({ atleta }: { atleta: AtletaDoc }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [alvo, setAlvo] = useState<HistoricoPontoDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc);
        docs.sort((a, b) => (a.dataTreino < b.dataTreino ? 1 : -1));
        setLancamentos(docs);
      },
      () => setLancamentos([]),
    );
    return unsubscribe;
  }, [atleta.id]);

  async function handleEstornar(motivo: string) {
    if (!alvo) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "historico_pontos", alvo.id), {
        estornado: true,
        estornadoEm: serverTimestamp(),
        estornadoPor: uid,
        motivoEstorno: motivo,
      });
      batch.update(doc(db, "atletas", alvo.atletaId), {
        pontuacaoTotal: increment(-alvo.pontos),
        atualizadoEm: serverTimestamp(),
      });
      await batch.commit();
      await logAudit({
        acao: "estornar_lancamento",
        entidade: "historico_pontos",
        entidadeId: alvo.id,
        dados: { motivo, pontos: alvo.pontos, atletaId: alvo.atletaId },
        criadoPor: uid,
        criadoPorNome: autor.nome,
      });
      show("success", "Lançamento estornado.");
      setAlvo(null);
    } catch {
      show("error", "Não foi possível estornar agora. Tente novamente.");
    }
  }

  if (lancamentos === null) {
    return <div className="h-40 animate-pulse rounded-[var(--radius)] bg-bg" />;
  }

  if (lancamentos.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhum lançamento ainda"
        description="Pontuação, faltas e KM registrados para este atleta aparecem aqui."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {lancamentos.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{l.regraDesc}</p>
              <p className="text-xs text-text-muted">
                {formatShortDate(l.dataTreino)}
                {l.kmPercorrido ? ` · ${l.kmPercorrido} km` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <span className={`text-sm font-bold ${l.estornado ? "text-text-muted line-through" : "text-success"}`}>
                +{l.pontos}
              </span>
              <Badge tone={l.estornado ? "danger" : "success"}>{l.estornado ? "Estornado" : "Válido"}</Badge>
              {!l.estornado && (
                <button
                  onClick={() => setAlvo(l)}
                  className="inline-flex items-center gap-1 rounded-[var(--radius)] px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  <RotateCcw className="size-3.5" />
                  Estornar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <EstornarModal lancamento={alvo} onClose={() => setAlvo(null)} onConfirm={handleEstornar} />
    </>
  );
}
