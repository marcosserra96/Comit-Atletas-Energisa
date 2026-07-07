"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarCheck, MapPin } from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShortDate } from "@/lib/format";
import type { EventoDoc } from "@/lib/types";

const modalidadeLabel: Record<EventoDoc["modalidade"], string> = {
  ambas: "Corrida e Bicicleta",
  corrida: "Corrida",
  bicicleta: "Bicicleta",
};

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Eventos</h2>
        <p className="text-sm text-text-light">Agenda de provas e treinos do programa.</p>
      </div>

      {eventos === null ? (
        <Card className="h-40 animate-pulse" />
      ) : eventos.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Nenhum evento agendado"
            description="Quando o comitê publicar um evento, ele aparece aqui."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((evento) => (
            <Card key={evento.id} className="flex flex-col gap-3">
              <div>
                <p className="font-semibold text-text">{evento.titulo}</p>
                <p className="flex items-center gap-1.5 text-xs text-text-light">
                  <MapPin className="size-3.5" />
                  {evento.local}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{modalidadeLabel[evento.modalidade]}</Badge>
                <Badge tone="neutral">{formatShortDate(evento.data)}</Badge>
                {evento.km && <Badge tone="neutral">{evento.km} km</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
