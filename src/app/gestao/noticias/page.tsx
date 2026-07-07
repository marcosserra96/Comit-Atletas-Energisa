"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { Newspaper, Pin, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { formatRelativeTime } from "@/lib/format";
import { temPermissao } from "@/lib/permissoes";
import { NovaNoticiaModal } from "./NovaNoticiaModal";
import type { NoticiaDoc } from "@/lib/types";

export default function NoticiasPage() {
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "noticias"), orderBy("criadoEm", "desc")),
      (snap) => {
        setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc));
      },
      () => setNoticias([]),
    );
    return unsubscribe;
  }, []);

  async function handleRemover(noticia: NoticiaDoc) {
    try {
      await deleteDoc(doc(db, "noticias", noticia.id));
      show("success", "Notícia removida.");
    } catch {
      show("error", "Não foi possível remover agora. Tente novamente.");
    }
  }

  if (!temPermissao(usuario, "noticias")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-text">Notícias</h2>
          <p className="text-sm text-text-light">
            {noticias === null ? "Carregando…" : `${noticias.length} publicações.`}
          </p>
        </div>
        <Button onClick={() => setNovaOpen(true)}>
          <Plus className="size-4" />
          Publicar notícia
        </Button>
      </div>

      {noticias === null ? (
        <Card className="h-40 animate-pulse" />
      ) : noticias.length === 0 ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title="Nenhuma notícia publicada"
            description="Publique o primeiro comunicado para os atletas do programa."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {noticias.map((n) => (
            <Card key={n.id} className="flex items-start justify-between gap-3">
              <div>
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
              </div>
              <button
                onClick={() => handleRemover(n)}
                aria-label="Remover"
                className="shrink-0 rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <NovaNoticiaModal open={novaOpen} onClose={() => setNovaOpen(false)} />
    </div>
  );
}
