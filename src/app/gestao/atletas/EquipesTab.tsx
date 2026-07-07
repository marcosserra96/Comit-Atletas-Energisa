"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { SubTabs } from "@/components/ui/SubTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";
import type { AtletaDoc, Equipe } from "@/lib/types";

function useAtletasPorEquipe(equipe: Equipe) {
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("equipe", "==", equipe)),
      (snap) => setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setAtletas([]),
    );
    return unsubscribe;
  }, [equipe]);
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

type SubTab = "fila" | "bike" | "corrida" | "comite";

export function EquipesTab() {
  const [tab, setTab] = useState<SubTab>("fila");
  const filaBike = useAtletasPorEquipe("fila_bicicleta");
  const filaCorrida = useAtletasPorEquipe("fila_corrida");
  const bike = useAtletasPorEquipe("bicicleta");
  const corrida = useAtletasPorEquipe("corrida");
  const comite = useAtletasPorEquipe("comite");

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
          <div>
            <h4 className="mb-2 text-sm font-bold text-primary">Fila — Bicicleta</h4>
            <Card className="p-0">
              <ListaSimples atletas={filaBike} vazio="Nenhum atleta aguardando vaga na Bicicleta." />
            </Card>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-bold text-secondary">Fila — Corrida</h4>
            <Card className="p-0">
              <ListaSimples atletas={filaCorrida} vazio="Nenhum atleta aguardando vaga na Corrida." />
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
    </div>
  );
}
