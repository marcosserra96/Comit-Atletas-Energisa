"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarCheck, MapPin, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SportBadge } from "@/components/ui/SportBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatShortDate } from "@/lib/format";
import type { EventoDoc } from "@/lib/types";

export default function EventosAtletaPage() {
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), orderBy("data", "asc")),
      (snap) => setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
      () => setEventos([]),
    );
    return unsubscribe;
  }, []);

  const now = new Date().toISOString();
  const futureEvents = eventos?.filter(e => e.data >= now) ?? [];
  const pastEvents = eventos?.filter(e => e.data < now) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        icon={CalendarCheck} 
        title="Eventos" 
        description="Agenda de provas e treinos do programa." 
      />

      {eventos === null ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : eventos.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Nenhum evento agendado"
            description="Quando o comitê publicar um evento, ele aparece aqui."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {futureEvents.length > 0 && (
            <section className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-text">Próximos Eventos</h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {futureEvents.map((evento) => (
                  <Card key={evento.id} className="flex gap-4 p-4 hover:border-primary transition-colors">
                    <div className="flex flex-col items-center justify-center bg-bg-inset rounded-lg p-3 min-w-[70px]">
                      <span className="text-xs font-semibold text-text-light uppercase">
                        {new Date(evento.data).toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black text-text">
                        {new Date(evento.data).getDate()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <div>
                        <p className="font-bold text-text line-clamp-1">{evento.titulo}</p>
                        <p className="flex items-center gap-1.5 text-xs text-text-light mt-0.5">
                          <MapPin className="size-3.5" />
                          {evento.local}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                        <SportBadge sport={evento.modalidade} />
                        {evento.km && <Badge tone="neutral">{evento.km} km</Badge>}
                        <div className="flex items-center gap-1 ml-auto text-xs text-text-light hidden sm:flex">
                          <Users className="size-3.5" />
                          <span>- inscritos</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center ml-2">
                       <Button size="sm" variant="secondary">RSVP</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {pastEvents.length > 0 && (
            <section className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-text-muted">Eventos Passados</h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 opacity-75">
                {pastEvents.map((evento) => (
                  <Card key={evento.id} className="flex gap-4 p-4 bg-bg-inset/50">
                    <div className="flex flex-col items-center justify-center bg-bg-inset rounded-lg p-3 min-w-[70px]">
                      <span className="text-xs font-semibold text-text-muted uppercase">
                        {new Date(evento.data).toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black text-text-muted">
                        {new Date(evento.data).getDate()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <div>
                        <p className="font-semibold text-text-muted line-clamp-1">{evento.titulo}</p>
                        <p className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                          <MapPin className="size-3.5" />
                          {evento.local}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                        <Badge tone="neutral" className="opacity-70">{evento.modalidade}</Badge>
                        <Badge tone="neutral" className="opacity-70">{formatShortDate(evento.data)}</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
