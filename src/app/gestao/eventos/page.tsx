"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarCheck, FileSpreadsheet, MapPin, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { formatShortDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { temPermissao } from "@/lib/permissoes";
import { NovoEventoModal } from "./NovoEventoModal";
import type { EventoDoc } from "@/lib/types";

const modalidadeLabel: Record<EventoDoc["modalidade"], string> = {
  ambas: "Corrida e Bicicleta",
  corrida: "Corrida",
  bicicleta: "Bicicleta",
};

export default function EventosPage() {
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), orderBy("data", "asc")),
      (snap) => {
        setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc));
      },
      () => setEventos([]),
    );
    return unsubscribe;
  }, []);

  async function handleRemover(evento: EventoDoc) {
    try {
      await deleteDoc(doc(db, "agenda_eventos", evento.id));
      show("success", "Evento removido da agenda.");
    } catch {
      show("error", "Não foi possível remover agora. Tente novamente.");
    }
  }

  function handleExportar() {
    exportToExcel(
      "lista-eventos.xlsx",
      "Eventos",
      (eventos ?? []).map((e) => ({
        Título: e.titulo,
        Local: e.local,
        Modalidade: modalidadeLabel[e.modalidade],
        Data: e.data,
        KM: e.km ?? "",
      })),
    );
  }

  if (!temPermissao(usuario, "eventos")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-text">Eventos</h2>
          <p className="text-sm text-text-light">
            {eventos === null ? "Carregando…" : `${eventos.length} eventos na agenda.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportar} disabled={!eventos || eventos.length === 0}>
            <FileSpreadsheet className="size-4" />
            Exportar
          </Button>
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="size-4" />
            Novo evento
          </Button>
        </div>
      </div>

      {eventos === null ? (
        <Card className="h-40 animate-pulse" />
      ) : eventos.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Nenhum evento agendado"
            description="Publique o primeiro evento do programa para os atletas verem na agenda."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((evento) => (
            <Card key={evento.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text">{evento.titulo}</p>
                  <p className="flex items-center gap-1.5 text-xs text-text-light">
                    <MapPin className="size-3.5" />
                    {evento.local}
                  </p>
                </div>
                <button
                  onClick={() => handleRemover(evento)}
                  aria-label="Remover"
                  className="shrink-0 rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
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

      <NovoEventoModal open={novoOpen} onClose={() => setNovoOpen(false)} />
    </div>
  );
}
