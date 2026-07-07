"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { FileClock } from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import type { AuditoriaDoc } from "@/lib/types";

const acaoLabel: Record<string, string> = {
  aprovar_acesso: "Aprovação de acesso",
  vincular_acesso: "Vínculo de acesso",
  criar_perfil_acesso: "Criação de perfil",
  recusar_acesso: "Recusa de acesso",
  cadastrar_atleta: "Cadastro de atleta",
  editar_atleta: "Edição de atleta",
  estornar_lancamento: "Estorno de lançamento",
  alterar_perfil_usuario: "Alteração de perfil",
};

export function AuditoriaTab() {
  const [registros, setRegistros] = useState<AuditoriaDoc[] | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "auditoria"), orderBy("criadoEm", "desc"), limit(50)),
      (snap) => setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditoriaDoc)),
      () => setRegistros([]),
    );
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-light">Últimas 50 ações registradas no portal.</p>

      {registros === null ? (
        <Card className="h-64 animate-pulse" />
      ) : registros.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileClock}
            title="Nenhum registro ainda"
            description="Ações sensíveis (aprovações, lançamentos, estornos) aparecem aqui."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="px-4 py-3 font-semibold">Ação</th>
                <th className="px-3 py-3 font-semibold">Responsável</th>
                <th className="px-3 py-3 font-semibold">Quando</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Badge tone="primary">{acaoLabel[r.acao] ?? r.acao}</Badge>
                  </td>
                  <td className="px-3 py-3 text-text">{r.criadoPorNome}</td>
                  <td className="px-3 py-3 text-text-light">{formatDateTime(r.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
