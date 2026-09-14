"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { AlertCircle, ChevronRight, Newspaper, Pin, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatRelativeTime } from "@/lib/format";
import type { NoticiaDoc } from "@/lib/types";

function NoticiaCard({ noticia, destaque = false }: { noticia: NoticiaDoc; destaque?: boolean }) {
  const { withPreview } = useAthleteView();

  return (
    <Link href={withPreview("/noticias/" + noticia.id)} className="group block">
      <Card
        className={
          "flex h-full flex-col transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-[var(--shadow-elevated)] " +
          (destaque ? "border-primary/20 bg-gradient-to-br from-primary/10 via-bg-card to-secondary/10 p-6" : "")
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            {noticia.fixado && destaque && (
              <Badge tone="primary" className="w-fit">
                <Pin className="mr-1 size-3.5" />
                Destaque
              </Badge>
            )}
            <h2 className={destaque ? "text-2xl font-bold text-text" : "text-lg font-bold text-text"}>
              {noticia.titulo}
            </h2>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted transition-colors group-hover:bg-primary group-hover:text-white">
            <ChevronRight className="size-5" />
          </span>
        </div>

        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-light">
          {noticia.resumo}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-5 text-xs font-medium text-text-muted">
          {noticia.autorNome && <span>{noticia.autorNome}</span>}
          {noticia.autorNome && <span>•</span>}
          <span>{formatRelativeTime(noticia.criadoEm)}</span>
        </div>
      </Card>
    </Link>
  );
}

export default function NoticiasAtletaPage() {
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "noticias"), orderBy("criadoEm", "desc")),
      (snap) => {
        setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc));
        setErroCarregamento(false);
      },
      () => {
        setNoticias([]);
        setErroCarregamento(true);
      },
    );
    return unsubscribe;
  }, []);

  const destaque = noticias?.find((noticia) => noticia.fixado);
  const demais = noticias?.filter((noticia) => noticia.id !== destaque?.id) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Newspaper}
        title="Notícias"
        description="Comunicados e novidades do programa."
      />

      {erroCarregamento ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertCircle className="size-8 text-danger" />
          <div>
            <h2 className="font-bold text-text">Não foi possível carregar as notícias</h2>
            <p className="mt-1 text-sm text-text-light">Confira sua conexão e tente novamente.</p>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </Card>
      ) : noticias === null ? (
        <div className="flex flex-col gap-4">
          <SkeletonCard className="h-52" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SkeletonCard className="h-44" />
            <SkeletonCard className="h-44" />
          </div>
        </div>
      ) : noticias.length === 0 ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title="Nenhuma notícia publicada"
            description="Comunicados do comitê aparecerão aqui."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {destaque && <NoticiaCard noticia={destaque} destaque />}
          {demais.length > 0 && (
            <section className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
              {demais.map((noticia) => (
                <NoticiaCard key={noticia.id} noticia={noticia} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
