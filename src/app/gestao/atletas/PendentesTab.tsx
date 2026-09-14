"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { UserCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestCard } from "./RequestCard";
import { RejectedRequestCard } from "./RejectedRequestCard";
import type { AtletaDoc, SolicitacaoAcessoDoc } from "@/lib/types";

export function PendentesTab() {
  const [pendentes, setPendentes] = useState<SolicitacaoAcessoDoc[] | null>(null);
  const [atletasSemVinculo, setAtletasSemVinculo] = useState<AtletaDoc[]>([]);
  const [recusadas, setRecusadas] = useState<SolicitacaoAcessoDoc[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "solicitacoes_acesso"),
        where("status", "==", "pendente"),
        orderBy("criadoEm", "asc"),
      ),
      (snap) => setPendentes(snap.docs.map((d) => d.data() as SolicitacaoAcessoDoc)),
      () => setPendentes([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "solicitacoes_acesso"), where("status", "==", "recusado")),
      (snap) =>
        setRecusadas(
          snap.docs
            .map((documento) => documento.data() as SolicitacaoAcessoDoc)
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        ),
      () => setRecusadas([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("authUid", "==", null)),
      (snap) => {
        setAtletasSemVinculo(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc));
      },
    );
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-light">
        {pendentes === null
          ? "Carregando solicitações…"
          : pendentes.length === 0
            ? "Nenhuma solicitação pendente no momento."
            : `${pendentes.length} ${pendentes.length > 1 ? "solicitações" : "solicitação"} aguardando aprovação.`}
      </p>

      {pendentes === null ? (
        <Card className="h-40 animate-pulse" />
      ) : pendentes.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserCheck}
            title="Tudo em dia!"
            description="Novos pedidos de acesso aparecem aqui automaticamente."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pendentes.map((solicitacao) => (
            <RequestCard
              key={solicitacao.uid}
              solicitacao={solicitacao}
              atletasSemVinculo={atletasSemVinculo}
            />
          ))}
        </div>
      )}

      {recusadas.length > 0 && (
        <section className="mt-4 flex flex-col gap-3">
          <div>
            <h3 className="font-bold text-text">Solicitações recusadas</h3>
            <p className="text-xs text-text-light">
              Reabra uma análise ou exclua o pedido para permitir uma nova solicitação.
            </p>
          </div>
          {recusadas.map((solicitacao) => (
            <RejectedRequestCard key={solicitacao.uid} solicitacao={solicitacao} />
          ))}
        </section>
      )}
    </div>
  );
}
