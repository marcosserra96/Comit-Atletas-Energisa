"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Bike, Footprints, Trophy } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import type { AtletaDoc } from "@/lib/types";

function RankingList({
  titulo,
  icon: Icon,
  atletas,
  meuId,
}: {
  titulo: string;
  icon: typeof Footprints;
  atletas: AtletaDoc[] | null;
  meuId: string;
}) {
  return (
    <Card className="flex flex-col p-0">
      <h3 className="flex items-center gap-2 p-5 pb-3 text-sm font-bold text-text">
        <Icon className="size-4 text-text-muted" />
        {titulo}
      </h3>
      {atletas === null ? (
        <div className="m-5 h-40 animate-pulse rounded-[var(--radius)] bg-bg" />
      ) : atletas.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            icon={Trophy}
            title="Sem ranking ainda"
            description="Assim que houver pontuação, o ranking aparece aqui."
          />
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border pb-2">
          {atletas.map((a, index) => (
            <li
              key={a.id}
              className={cn(
                "flex items-center justify-between px-5 py-3 text-sm",
                a.id === meuId && "bg-primary/5",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    index === 0
                      ? "bg-accent/15 text-accent"
                      : index === 1
                        ? "bg-text-muted/15 text-text-light"
                        : index === 2
                          ? "bg-secondary/15 text-secondary"
                          : "bg-bg text-text-muted",
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn("font-medium text-text", a.id === meuId && "font-bold")}>
                  {a.nome}
                  {a.id === meuId && " (você)"}
                </span>
              </div>
              <span className="font-bold text-text">{a.pontuacaoTotal} pts</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function RankingPage() {
  const { atleta } = useActiveSession();
  const [corredores, setCorredores] = useState<AtletaDoc[] | null>(null);
  const [ciclistas, setCiclistas] = useState<AtletaDoc[] | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "atletas"),
        where("equipe", "==", "corrida"),
        orderBy("pontuacaoTotal", "desc"),
      ),
      (snap) => setCorredores(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setCorredores([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "atletas"),
        where("equipe", "==", "bicicleta"),
        orderBy("pontuacaoTotal", "desc"),
      ),
      (snap) => setCiclistas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setCiclistas([]),
    );
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Ranking</h2>
        <p className="text-sm text-text-light">Classificação por modalidade.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingList
          titulo="Corrida"
          icon={Footprints}
          atletas={corredores}
          meuId={atleta.id}
        />
        <RankingList
          titulo="Bicicleta"
          icon={Bike}
          atletas={ciclistas}
          meuId={atleta.id}
        />
      </div>
    </div>
  );
}
