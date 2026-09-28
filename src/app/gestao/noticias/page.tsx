"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarClock, Newspaper, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { formatRelativeTime, formatShortDate, plural } from "@/lib/format";
import { noticiaVisivel } from "@/lib/noticias";
import { temPermissao } from "@/lib/permissoes";
import { NoticiaModal } from "./NoticiaModal";
import type { NoticiaDoc } from "@/lib/types";

const botaoIcone =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors";

function NoticiaItem({
  noticia,
  noAr,
  onEditar,
  onRemover,
}: {
  noticia: NoticiaDoc;
  noAr: boolean;
  onEditar: () => void;
  onRemover: () => void;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-text">{noticia.titulo}</p>
        <p className="mt-1 line-clamp-2 text-sm text-text-light">{noticia.resumo}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {noticia.fixado && noAr && (
            <Badge tone="warning">
              <Pin className="size-3" />
              Fixada
            </Badge>
          )}
          {noticia.visivelAte && (
            <Badge tone={noAr ? "primary" : "neutral"}>
              <CalendarClock className="size-3" />
              {noAr
                ? `No ar até ${formatShortDate(noticia.visivelAte)}`
                : `Ficou no ar até ${formatShortDate(noticia.visivelAte)}`}
            </Badge>
          )}
          <span className="text-xs text-text-muted">
            {noticia.autorNome} · {formatRelativeTime(noticia.criadoEm)}
          </span>
        </div>
      </div>
      <div className="-mr-2 -mt-2 flex shrink-0">
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar “${noticia.titulo}”`}
          className={`${botaoIcone} hover:bg-primary/10 hover:text-primary`}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover “${noticia.titulo}”`}
          className={`${botaoIcone} hover:bg-danger/10 hover:text-danger`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </Card>
  );
}

export default function NoticiasPage() {
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);
  const [formulario, setFormulario] = useState<{ aberto: boolean; noticia: NoticiaDoc | null; versao: number }>({
    aberto: false,
    noticia: null,
    versao: 0,
  });
  const [removendo, setRemovendo] = useState<NoticiaDoc | null>(null);

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

  const { noAr, encerradas } = useMemo(() => {
    const lista = noticias ?? [];
    const visiveis = lista.filter((n) => noticiaVisivel(n));
    return {
      // Fixadas primeiro, como o atleta vê.
      noAr: [...visiveis.filter((n) => n.fixado), ...visiveis.filter((n) => !n.fixado)],
      encerradas: lista.filter((n) => !noticiaVisivel(n)),
    };
  }, [noticias]);

  function abrirFormulario(noticia: NoticiaDoc | null) {
    setFormulario((atual) => ({ aberto: true, noticia, versao: atual.versao + 1 }));
  }

  async function handleRemover() {
    if (!removendo) return;
    try {
      await deleteDoc(doc(db, "noticias", removendo.id));
      setRemovendo(null);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Notícias</h1>
          <p className="text-sm text-text-light">
            {noticias === null
              ? "Carregando…"
              : `${plural(noAr.length, "notícia no ar", "notícias no ar")}` +
                (encerradas.length > 0 ? ` · ${plural(encerradas.length, "encerrada")}` : "")}
          </p>
        </div>
        <Button onClick={() => abrirFormulario(null)}>
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
        <>
          <section className="flex flex-col gap-3" aria-labelledby="noticias-no-ar">
            <h2 id="noticias-no-ar" className="text-xs font-bold uppercase tracking-wide text-text-muted">
              No ar para os atletas
            </h2>
            {noAr.length === 0 ? (
              <Card className="text-sm text-text-light">
                Nenhuma notícia no ar agora. Os atletas não veem notícias no Início.
              </Card>
            ) : (
              noAr.map((n) => (
                <NoticiaItem
                  key={n.id}
                  noticia={n}
                  noAr
                  onEditar={() => abrirFormulario(n)}
                  onRemover={() => setRemovendo(n)}
                />
              ))
            )}
          </section>

          {encerradas.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="noticias-encerradas">
              <div>
                <h2 id="noticias-encerradas" className="text-xs font-bold uppercase tracking-wide text-text-muted">
                  Encerradas
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  Só a gestão vê. Para voltar a publicar, edite e mude a data.
                </p>
              </div>
              {encerradas.map((n) => (
                <NoticiaItem
                  key={n.id}
                  noticia={n}
                  noAr={false}
                  onEditar={() => abrirFormulario(n)}
                  onRemover={() => setRemovendo(n)}
                />
              ))}
            </section>
          )}
        </>
      )}

      <NoticiaModal
        key={formulario.versao}
        open={formulario.aberto}
        noticia={formulario.noticia}
        onClose={() => setFormulario((atual) => ({ ...atual, aberto: false }))}
      />
      <ConfirmActionModal
        open={!!removendo}
        title="Excluir notícia"
        description={`A notícia “${removendo?.titulo ?? ""}” será apagada permanentemente.`}
        onClose={() => setRemovendo(null)}
        onConfirm={handleRemover}
      />
    </div>
  );
}
