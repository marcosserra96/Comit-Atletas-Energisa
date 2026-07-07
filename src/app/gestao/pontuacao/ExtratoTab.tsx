"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { History, RotateCcw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { logAudit } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { EstornarModal } from "./EstornarModal";
import type { HistoricoPontoDoc } from "@/lib/types";

export function ExtratoTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [alvo, setAlvo] = useState<HistoricoPontoDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "historico_pontos"), orderBy("criadoEm", "desc"), limit(50)),
      (snap) => {
        setLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
      },
      () => setLancamentos([]),
    );
    return unsubscribe;
  }, []);

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
        criadoPorNome: atleta.nome,
      });
      show("success", "Lançamento estornado.");
      setAlvo(null);
    } catch {
      show("error", "Não foi possível estornar agora. Tente novamente.");
    }
  }

  if (lancamentos === null) {
    return <Card className="h-64 animate-pulse" />;
  }

  if (lancamentos.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={History}
          title="Nenhum lançamento ainda"
          description="Os lançamentos de pontos aparecem aqui assim que forem registrados."
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
              <th className="px-4 py-3 font-semibold">Atleta</th>
              <th className="px-3 py-3 font-semibold">Regra</th>
              <th className="px-3 py-3 font-semibold">Data</th>
              <th className="px-3 py-3 text-right font-semibold">Pontos</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-text">{l.atletaNome}</td>
                <td className="px-3 py-3 text-text-light">{l.regraDesc}</td>
                <td className="px-3 py-3 text-text-light">{formatShortDate(l.dataTreino)}</td>
                <td className="px-3 py-3 text-right font-semibold text-text">
                  {l.estornado ? (
                    <span className="text-text-muted line-through">+{l.pontos}</span>
                  ) : (
                    <span className="text-success">+{l.pontos}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={l.estornado ? "danger" : "success"}>
                    {l.estornado ? "Estornado" : "Válido"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {!l.estornado && (
                    <button
                      onClick={() => setAlvo(l)}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                    >
                      <RotateCcw className="size-3.5" />
                      Estornar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <EstornarModal lancamento={alvo} onClose={() => setAlvo(null)} onConfirm={handleEstornar} />
    </>
  );
}
