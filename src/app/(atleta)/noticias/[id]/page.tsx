"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { AlertCircle, ArrowLeft, Newspaper, Pin, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { formatRelativeTime } from "@/lib/format";
import type { NoticiaDoc } from "@/lib/types";

export default function DetalheNoticiaPage() {
  const params = useParams<{ id: string }>();
  const noticiaId = params.id;
  const { withPreview } = useAthleteView();
  const [noticia, setNoticia] = useState<NoticiaDoc | null | undefined>(undefined);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  useEffect(() => {
    if (!noticiaId) return;
    const unsubscribe = onSnapshot(
      doc(db, "noticias", noticiaId),
      (snap) => {
        setNoticia(snap.exists() ? ({ id: snap.id, ...snap.data() } as NoticiaDoc) : null);
        setErroCarregamento(false);
      },
      () => {
        setNoticia(null);
        setErroCarregamento(true);
      },
    );
    return unsubscribe;
  }, [noticiaId]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Link
        href={withPreview("/noticias")}
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
      >
        <ArrowLeft className="size-4" />
        Voltar para notícias
      </Link>

      {erroCarregamento ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertCircle className="size-8 text-danger" />
          <div>
            <h1 className="font-bold text-text">Não foi possível carregar a notícia</h1>
            <p className="mt-1 text-sm text-text-light">Confira sua conexão e tente novamente.</p>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </Card>
      ) : noticia === undefined ? (
        <Card className="flex flex-col gap-4 p-8">
          <SkeletonLine className="h-5 w-28" />
          <SkeletonLine className="h-10 w-4/5" />
          <SkeletonLine className="h-4 w-48" />
          <SkeletonCard className="mt-4 h-64" />
        </Card>
      ) : noticia === null ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title="Notícia não encontrada"
            description="Ela pode ter sido removida pelo comitê."
          />
        </Card>
      ) : (
        <article>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-gradient-to-br from-primary/10 via-bg-card to-secondary/10 p-6 sm:p-9">
              <div className="flex flex-wrap items-center gap-2">
                {noticia.fixado && (
                  <Badge tone="primary">
                    <Pin className="mr-1 size-3.5" />
                    Destaque
                  </Badge>
                )}
                <span className="text-xs font-medium text-text-muted">
                  {formatRelativeTime(noticia.criadoEm)}
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-extrabold leading-tight text-text sm:text-4xl">
                {noticia.titulo}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-text-light sm:text-lg">
                {noticia.resumo}
              </p>
              {noticia.autorNome && (
                <p className="mt-5 text-sm font-semibold text-text">
                  Publicado por {noticia.autorNome}
                </p>
              )}
            </div>
            <div className="p-6 sm:p-9">
              <div className="whitespace-pre-wrap text-[15px] leading-8 text-text">
                {noticia.corpo || noticia.resumo}
              </div>
            </div>
          </Card>
        </article>
      )}
    </div>
  );
}
