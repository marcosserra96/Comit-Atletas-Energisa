"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Newspaper, Pin, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatRelativeTime } from "@/lib/format";
import type { NoticiaDoc } from "@/lib/types";

function NoticiaCard({ noticia, isHero = false }: { noticia: NoticiaDoc; isHero?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card 
      className={`flex flex-col cursor-pointer transition-colors hover:border-primary/50 ${
        isHero ? "bg-primary/5 border-primary/20 shadow-sm p-6" : "p-5"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-2">
            {noticia.fixado && isHero && (
              <Badge tone="primary" className="w-fit">
                <Pin className="size-3.5 mr-1" /> Destaque
              </Badge>
            )}
            <h3 className={`font-bold text-text ${isHero ? "text-2xl" : "text-lg"}`}>
              {noticia.titulo}
            </h3>
          </div>
          <button 
            type="button" 
            className="text-text-muted hover:text-text rounded-full p-1"
            aria-label="Expandir notícia"
          >
            {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted font-medium">
          {noticia.autorNome && <span>{noticia.autorNome}</span>}
          {noticia.autorNome && <span>•</span>}
          <span>{formatRelativeTime(noticia.criadoEm)}</span>
        </div>

        <div className={`text-text-light text-sm leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
          {noticia.resumo}
        </div>
      </div>
    </Card>
  );
}

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

  const pinnedNews = noticias?.find(n => n.fixado);
  const regularNews = noticias?.filter(n => n.id !== pinnedNews?.id) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        icon={Newspaper} 
        title="Notícias" 
        description="Comunicados e novidades do comitê do programa." 
      />

      {noticias === null ? (
        <div className="flex flex-col gap-4">
          <SkeletonCard className="h-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : noticias.length === 0 ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title="Nenhuma notícia publicada"
            description="Comunicados do comitê vão aparecer aqui assim que forem publicados."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {pinnedNews && (
            <section>
              <NoticiaCard noticia={pinnedNews} isHero />
            </section>
          )}

          {regularNews.length > 0 && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {regularNews.map((n) => (
                <NoticiaCard key={n.id} noticia={n} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
