"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Newspaper, Pin } from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/format";
import type { NoticiaDoc } from "@/lib/types";

export default function NoticiasAtletaPage() {
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "noticias"), orderBy("criadoEm", "desc")),
      (snap) => setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc)),
      () => setNoticias([]),
    );
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Notícias</h2>
        <p className="text-sm text-text-light">Comunicados do comitê do programa.</p>
      </div>

      {noticias === null ? (
        <Card className="h-40 animate-pulse" />
      ) : noticias.length === 0 ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title="Nenhuma notícia publicada"
            description="Comunicados do comitê vão aparecer aqui assim que forem publicados."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {noticias.map((n) => (
            <Card key={n.id}>
              <div className="mb-1 flex items-center gap-2">
                {n.fixado && (
                  <Badge tone="warning">
                    <Pin className="size-3" />
                    Fixado
                  </Badge>
                )}
                <p className="font-semibold text-text">{n.titulo}</p>
              </div>
              <p className="text-sm text-text-light">{n.resumo}</p>
              <p className="mt-1.5 text-xs text-text-muted">
                {n.autorNome} · {formatRelativeTime(n.criadoEm)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
