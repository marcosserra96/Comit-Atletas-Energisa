"use client";

import { useState } from "react";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { AlertOctagon, CalendarX, History, ListX, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logAudit } from "@/lib/audit";
import { ConfirmarPerigoModal } from "./ConfirmarPerigoModal";

type ZonaPerigo = "historico_pontos" | "agenda_eventos" | "regras_pontuacao" | "comentarios_atletas";

const zonas: { colecao: ZonaPerigo; label: string; icon: typeof History }[] = [
  { colecao: "historico_pontos", label: "Apagar lançamentos", icon: History },
  { colecao: "agenda_eventos", label: "Apagar eventos", icon: CalendarX },
  { colecao: "regras_pontuacao", label: "Apagar regras", icon: ListX },
];

export function DiagnosticoTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [zonaAlvo, setZonaAlvo] = useState<ZonaPerigo | null>(null);

  async function handleApagarZona() {
    if (!zonaAlvo) return;
    try {
      const snap = await getDocs(collection(db, zonaAlvo));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, zonaAlvo, d.id))));
      await logAudit({
        acao: "manutencao_apagar_colecao",
        entidade: zonaAlvo,
        entidadeId: zonaAlvo,
        dados: { quantidade: snap.size },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      show("success", `${snap.size} registro(s) apagados de "${zonaAlvo}".`);
      setZonaAlvo(null);
    } catch {
      show("error", "Não foi possível apagar agora. Tente novamente.");
    }
  }

  const zonaAtual = zonas.find((z) => z.colecao === zonaAlvo);

  return (
    <div className="flex flex-col gap-5">
      <Card className="max-w-xl border-danger/30">
        <div className="mb-4 flex items-center gap-2">
          <AlertOctagon className="size-4 text-danger" />
          <h3 className="text-sm font-bold text-text">Manutenção sensível</h3>
        </div>
        <p className="mb-4 text-xs text-text-light">
          Ações permanentes. Exija a palavra-chave antes de confirmar — cada exclusão fica
          registrada na auditoria.
        </p>
        <div className="flex flex-wrap gap-2">
          {zonas.map((z) => (
            <Button
              key={z.colecao}
              variant="danger"
              size="sm"
              onClick={() => setZonaAlvo(z.colecao)}
            >
              <z.icon className="size-4" />
              {z.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
          <Users className="size-3.5" />
          Exclusão de atletas e usuários fica em Atletas / Usuários e permissões.
        </p>
      </Card>

      <ConfirmarPerigoModal
        open={!!zonaAlvo}
        titulo={zonaAtual?.label ?? ""}
        descricao="Essa ação apaga todos os registros dessa coleção permanentemente."
        palavraChave="APAGAR"
        onClose={() => setZonaAlvo(null)}
        onConfirm={handleApagarZona}
      />
    </div>
  );
}
