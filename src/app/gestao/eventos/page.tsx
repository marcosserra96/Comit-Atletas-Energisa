"use client";

import { ehReuniao, horarioDoEvento } from "@/lib/eventos";
import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarCheck, ChevronRight, FileSpreadsheet, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { formatKm, formatShortDate, plural } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { temPermissao } from "@/lib/permissoes";
import { EventoModal } from "./EventoModal";
import { ConfirmadosModal } from "./ConfirmadosModal";
import type { AtletaDoc, EventoDoc } from "@/lib/types";

const modalidadeDoEvento: Record<EventoDoc["modalidade"], string> = {
  ambas: "Corrida e Bike",
  corrida: "Corrida",
  bicicleta: "Bike",
};

const botaoIcone =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors";

function EventoCard({
  evento,
  onConfirmados,
  onEditar,
  onRemover,
}: {
  evento: EventoDoc;
  onConfirmados: () => void;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const confirmados = evento.inscritos?.length ?? 0;
  return (
    <Card className="flex flex-col gap-3 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-text">{evento.titulo}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-light">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{evento.local}</span>
          </p>
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0">
          <button
            type="button"
            onClick={onEditar}
            aria-label={`Editar “${evento.titulo}”`}
            className={`${botaoIcone} hover:bg-primary/10 hover:text-primary`}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemover}
            aria-label={`Remover “${evento.titulo}”`}
            className={`${botaoIcone} hover:bg-danger/10 hover:text-danger`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{modalidadeDoEvento[evento.modalidade]}</Badge>
        {ehReuniao(evento) ? <Badge tone="accent">Reunião</Badge> : null}
        <Badge tone="neutral">
          {formatShortDate(evento.data)}
          {horarioDoEvento(evento) ? ` · ${horarioDoEvento(evento)}` : ""}
        </Badge>
        {evento.km && !ehReuniao(evento) ? <Badge tone="neutral">{formatKm(evento.km)}</Badge> : null}
      </div>
      <button
        type="button"
        onClick={onConfirmados}
        className="-mx-2 mt-auto flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius)] border-t border-border px-2 pt-2 text-sm font-semibold text-text transition-colors hover:text-primary"
      >
        <span className="flex items-center gap-2">
          <Users className="size-4 text-text-muted" />
          {confirmados === 0 ? "Ninguém confirmou ainda" : plural(confirmados, "confirmado")}
        </span>
        <span className="flex items-center gap-0.5 text-primary">
          Ver lista
          <ChevronRight className="size-4" />
        </span>
      </button>
    </Card>
  );
}

export default function EventosPage() {
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [formulario, setFormulario] = useState<{ aberto: boolean; evento: EventoDoc | null; versao: number }>({
    aberto: false,
    evento: null,
    versao: 0,
  });
  const [lista, setLista] = useState<{ aberto: boolean; eventoId: string | null; versao: number }>({
    aberto: false,
    eventoId: null,
    versao: 0,
  });
  const [removendo, setRemovendo] = useState<EventoDoc | null>(null);

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

  useEffect(() => {
    let ativo = true;
    getDocs(collection(db, "atletas"))
      .then((snap) => {
        if (ativo) setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc));
      })
      .catch(() => {
        if (ativo) setAtletas([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const { proximos, realizados } = useMemo(() => {
    const hoje = dataIsoLocal();
    const todos = eventos ?? [];
    return {
      proximos: todos.filter((e) => e.data >= hoje),
      realizados: todos.filter((e) => e.data < hoje).reverse(),
    };
  }, [eventos]);

  // Sempre a versão mais recente do evento, para a lista refletir novas confirmações na hora.
  const eventoDaLista = eventos?.find((e) => e.id === lista.eventoId) ?? null;

  async function handleRemover() {
    if (!removendo) return;
    try {
      await deleteDoc(doc(db, "agenda_eventos", removendo.id));
      setRemovendo(null);
      show("success", "Evento removido da agenda.");
    } catch {
      show("error", "Não foi possível remover agora. Tente novamente.");
    }
  }

  function handleExportar() {
    void exportToExcel(
      "lista-eventos.xlsx",
      "Eventos",
      (eventos ?? []).map((e) => ({
        Título: e.titulo,
        Local: e.local,
        Modalidade: modalidadeDoEvento[e.modalidade],
        Data: e.data,
        KM: e.km ?? "",
        Confirmados: e.inscritos?.length ?? 0,
      })),
    );
  }

  function renderGrupo(titulo: string, id: string, grupo: EventoDoc[]) {
    return (
      <section className="flex flex-col gap-3" aria-labelledby={id}>
        <h2 id={id} className="text-xs font-bold uppercase tracking-wide text-text-muted">
          {titulo}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grupo.map((evento) => (
            <EventoCard
              key={evento.id}
              evento={evento}
              onConfirmados={() =>
                setLista((atual) => ({ aberto: true, eventoId: evento.id, versao: atual.versao + 1 }))
              }
              onEditar={() =>
                setFormulario((atual) => ({ aberto: true, evento, versao: atual.versao + 1 }))
              }
              onRemover={() => setRemovendo(evento)}
            />
          ))}
        </div>
      </section>
    );
  }

  if (!temPermissao(usuario, "eventos")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Eventos</h1>
          <p className="text-sm text-text-light">
            {eventos === null
              ? "Carregando…"
              : `${plural(proximos.length, "evento próximo", "eventos próximos")}` +
                (realizados.length > 0 ? ` · ${plural(realizados.length, "realizado")}` : "")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportar} disabled={!eventos || eventos.length === 0}>
            <FileSpreadsheet className="size-4" />
            Exportar
          </Button>
          <Button onClick={() => setFormulario((atual) => ({ aberto: true, evento: null, versao: atual.versao + 1 }))}>
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
        <>
          {proximos.length > 0 ? (
            renderGrupo("Próximos", "eventos-proximos", proximos)
          ) : (
            <Card className="text-sm text-text-light">
              Nenhum evento futuro na agenda. Use “Novo evento” para publicar o próximo.
            </Card>
          )}
          {realizados.length > 0 && renderGrupo("Realizados", "eventos-realizados", realizados)}
        </>
      )}

      <EventoModal
        key={`form-${formulario.versao}`}
        open={formulario.aberto}
        evento={formulario.evento}
        onClose={() => setFormulario((atual) => ({ ...atual, aberto: false }))}
      />
      <ConfirmadosModal
        key={`lista-${lista.versao}`}
        open={lista.aberto}
        evento={eventoDaLista}
        atletas={atletas}
        onClose={() => setLista((atual) => ({ ...atual, aberto: false }))}
      />
      <ConfirmActionModal
        open={!!removendo}
        title="Excluir evento"
        description={
          removendo && (removendo.inscritos?.length ?? 0) > 0
            ? `O evento “${removendo.titulo}” será removido da agenda junto com ${plural(removendo.inscritos!.length, "confirmação", "confirmações")}. Essa ação não pode ser desfeita.`
            : `O evento “${removendo?.titulo ?? ""}” será removido da agenda. Essa ação não pode ser desfeita.`
        }
        onClose={() => setRemovendo(null)}
        onConfirm={handleRemover}
      />
    </div>
  );
}
