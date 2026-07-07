"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import type { AtletaDoc, AuditoriaDoc } from "@/lib/types";

const acaoLabel: Record<string, string> = {
  aprovar_acesso: "Aprovação de acesso",
  vincular_acesso: "Vínculo de acesso",
  criar_perfil_acesso: "Criação de perfil",
  recusar_acesso: "Recusa de acesso",
  cadastrar_atleta: "Cadastro de atleta",
  importar_atletas: "Importação em lote",
  editar_atleta: "Edição de atleta",
  desativar_atleta: "Desativação",
  reativar_atleta: "Reativação",
  estornar_lancamento: "Estorno de lançamento",
  alterar_perfil_usuario: "Alteração de perfil",
};

export function FichaAuditoriaTab({ atleta }: { atleta: AtletaDoc }) {
  const [registros, setRegistros] = useState<AuditoriaDoc[] | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "auditoria"), where("entidadeId", "==", atleta.id)),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditoriaDoc);
        docs.sort((a, b) => {
          const ta = (a.criadoEm as { toMillis?: () => number })?.toMillis?.() ?? 0;
          const tb = (b.criadoEm as { toMillis?: () => number })?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setRegistros(docs);
      },
      () => setRegistros([]),
    );
    return unsubscribe;
  }, [atleta.id]);

  if (registros === null) {
    return <div className="h-24 animate-pulse rounded-[var(--radius)] bg-bg" />;
  }

  if (registros.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nenhum registro ainda"
        description="Alterações de cadastro, status e lançamentos deste atleta aparecem aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {registros.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5"
        >
          <Badge tone="primary">{acaoLabel[r.acao] ?? r.acao}</Badge>
          <span className="text-xs text-text-light">{r.criadoPorNome}</span>
          <span className="text-xs text-text-muted">{formatDateTime(r.criadoEm)}</span>
        </div>
      ))}
    </div>
  );
}
