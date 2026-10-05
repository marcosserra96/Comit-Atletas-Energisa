"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { CalendarClock, UsersRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useBuscaDaUrl } from "@/lib/useBuscaDaUrl";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmarPresenca } from "@/components/reunioes/ConfirmarPresenca";
import { useReuniaoAgora } from "@/components/reunioes/AvisoReuniao";
import { formatShortDate } from "@/lib/format";
import { horarioDoEvento } from "@/lib/eventos";
import type { EventoDoc } from "@/lib/types";

/** Página aberta pelo QR code (câmera do celular) ou pelo botão da agenda. */
export default function PresencaPage() {
  const { id } = useParams<{ id: string }>();
  const busca = useBuscaDaUrl();
  const { isPreview, withPreview } = useAthleteView();
  const { marcarConfirmada } = useReuniaoAgora();
  const [evento, setEvento] = useState<EventoDoc | null | undefined>(undefined);

  useEffect(() => {
    getDoc(doc(db, "agenda_eventos", id))
      .then((s) => setEvento(s.exists() ? ({ id: s.id, ...s.data() } as EventoDoc) : null))
      .catch(() => setEvento(null));
  }, [id]);

  if (evento === undefined || busca === undefined) return <Card className="mx-auto h-80 w-full max-w-md animate-pulse" />;
  if (evento === null || evento.tipo !== "reuniao") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <EmptyState icon={UsersRound} title="Reunião não encontrada" description="Confira o QR code ou fale com o comitê." />
      </Card>
    );
  }

  const codigo = new URLSearchParams(busca).get("c") ?? undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-10">
      <Card className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-accent-subtle text-accent">
            <UsersRound className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Presença na reunião</p>
            <h1 className="text-lg font-extrabold text-text">{evento.titulo}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-light">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              {formatShortDate(evento.data)} · {horarioDoEvento(evento)}
            </p>
          </div>
        </div>
        {isPreview ? (
          <p className="text-sm text-text-muted">Visualização do comitê: a confirmação fica desativada.</p>
        ) : (
          <ConfirmarPresenca eventoId={evento.id} codigoInicial={codigo} onConcluido={() => marcarConfirmada(evento.id)} />
        )}
      </Card>
      <Link href={withPreview("/dashboard")} className="text-center text-sm font-semibold text-text-light hover:text-text">
        Ir para o início
      </Link>
    </div>
  );
}
