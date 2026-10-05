"use client";

import { ehReuniao, horarioDoEvento } from "@/lib/eventos";
import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { AlertCircle, CalendarCheck, CalendarPlus, Check, MapPin, Navigation, RefreshCw, Users, Video } from "lucide-react";
import type { ReactNode } from "react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SportBadge } from "@/components/ui/SportBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatKm, formatShortDate, plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import { modalidadeFromEquipe, modalidadeLabel } from "@/lib/labels";
import type { EventoDoc } from "@/lib/types";

function hojeIsoLocal() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function partesData(valor: string) {
  const data = new Date(valor + "T00:00:00");
  if (Number.isNaN(data.getTime())) return { mes: "—", dia: "—" };
  return {
    mes: data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    dia: String(data.getDate()).padStart(2, "0"),
  };
}

function escaparIcs(valor: string) {
  return valor.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function baixarEventoCalendario(evento: EventoDoc) {
  const inicio = evento.data.replaceAll("-", "");
  const comHorario = Boolean(evento.horaInicio);
  const hora = (valor: string) => valor.replace(":", "") + "00";
  const fimData = new Date(evento.data + "T12:00:00");
  fimData.setDate(fimData.getDate() + 1);
  const fim = [
    fimData.getFullYear(),
    String(fimData.getMonth() + 1).padStart(2, "0"),
    String(fimData.getDate()).padStart(2, "0"),
  ].join("");
  const conteudo = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atletas Energisa//Eventos//PT-BR",
    "BEGIN:VEVENT",
    "UID:" + evento.id + "@atletas-energisa",
    ...(comHorario
      ? [
          "DTSTART:" + inicio + "T" + hora(evento.horaInicio!),
          "DTEND:" + inicio + "T" + hora(evento.horaFim || evento.horaInicio!),
        ]
      : ["DTSTART;VALUE=DATE:" + inicio, "DTEND;VALUE=DATE:" + fim]),
    "SUMMARY:" + escaparIcs(evento.titulo),
    "LOCATION:" + escaparIcs(evento.linkOnline || evento.local),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = evento.titulo.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-") + ".ics";
  link.click();
  URL.revokeObjectURL(url);
}

function EventoCard({
  evento,
  confirmado,
  alterando,
  bloqueado,
  somenteVisualizacao,
  onAlternar,
}: {
  evento: EventoDoc;
  confirmado: boolean;
  alterando: boolean;
  bloqueado: boolean;
  somenteVisualizacao: boolean;
  onAlternar: () => void;
}) {
  const data = partesData(evento.data);
  const inscritos = evento.inscritos?.length ?? 0;
  const linkSecundario =
    "inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] px-2 text-sm font-semibold text-text-light transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <Card
      className={cn(
        "flex flex-col gap-4",
        confirmado && "border-success/40 shadow-[0_0_0_1px_var(--color-success-subtle)]",
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[var(--radius-lg)] bg-primary-subtle text-primary">
          <span className="text-xs font-bold uppercase">{data.mes}</span>
          <span className="text-2xl font-black leading-none tabular-nums">{data.dia}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-text sm:text-lg">{evento.titulo}</h3>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-text-light">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{evento.local}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {evento.modalidade === "ambas" ? (
              <Badge tone="neutral">Todas as modalidades</Badge>
            ) : (
              <SportBadge modalidade={evento.modalidade} size="sm" />
            )}
            {ehReuniao(evento) ? <Badge tone="accent">Reunião</Badge> : null}
            {horarioDoEvento(evento) ? <Badge tone="neutral">{horarioDoEvento(evento)}</Badge> : null}
            {evento.km && !ehReuniao(evento) ? <Badge tone="neutral">{formatKm(evento.km)}</Badge> : null}
            <span className="inline-flex items-center gap-1 text-xs text-text-light">
              <Users className="size-3.5" aria-hidden="true" />
              {plural(inscritos, "confirmado")}
            </span>
            {confirmado ? (
              <Badge tone="success">
                <Check className="mr-1 size-3" aria-hidden="true" />
                Presença confirmada
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-subtle pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 sm:-ml-2">
          {evento.linkOnline ? (
            <a href={evento.linkOnline} target="_blank" rel="noreferrer" className={linkSecundario}>
              <Video className="size-4" aria-hidden="true" />
              Entrar na reunião
            </a>
          ) : null}
          {!/^online$/i.test(evento.local.trim()) ? (
            <a
              href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(evento.local)}
              target="_blank"
              rel="noreferrer"
              className={linkSecundario}
            >
              <Navigation className="size-4" aria-hidden="true" />
              Ver mapa
            </a>
          ) : null}
          <button type="button" onClick={() => baixarEventoCalendario(evento)} className={cn(linkSecundario, "cursor-pointer")}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Salvar na agenda
          </button>
        </div>
        <Button
          size="sm"
          variant={confirmado ? "ghost" : "primary"}
          className="w-full shrink-0 sm:w-auto"
          loading={alterando}
          disabled={somenteVisualizacao || bloqueado}
          onClick={onAlternar}
        >
          {somenteVisualizacao
            ? "Somente visualização"
            : confirmado
              ? "Cancelar presença"
              : "Confirmar presença"}
        </Button>
      </div>
    </Card>
  );
}

function GrupoEventos({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-text-light">{titulo}</h3>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>
    </div>
  );
}

export default function EventosAtletaPage() {
  const { atleta, isPreview } = useAthleteView();
  const minhaModalidade = modalidadeFromEquipe(atleta.equipe);
  const { show } = useToast();
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), orderBy("data", "asc")),
      (snap) => {
        setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc));
        setErroCarregamento(false);
      },
      () => {
        setEventos([]);
        setErroCarregamento(true);
      },
    );
    return unsubscribe;
  }, []);

  const { futuros, passados } = useMemo(() => {
    const hoje = hojeIsoLocal();
    return {
      futuros: eventos?.filter((evento) => evento.data >= hoje) ?? [],
      passados: eventos?.filter((evento) => evento.data < hoje).reverse() ?? [],
    };
  }, [eventos]);

  async function alternarPresenca(evento: EventoDoc) {
    if (isPreview) return;
    const confirmado = evento.inscritos?.includes(atleta.id) ?? false;
    setAlterandoId(evento.id);
    try {
      await updateDoc(doc(db, "agenda_eventos", evento.id), {
        inscritos: confirmado ? arrayRemove(atleta.id) : arrayUnion(atleta.id),
      });
      show("success", confirmado ? "Presença cancelada." : "Presença confirmada!");
    } catch {
      show("error", "Não foi possível atualizar sua presença agora.");
    } finally {
      setAlterandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarCheck}
        title="Eventos"
        description="Agenda de provas, encontros e treinos do programa."
      />

      {erroCarregamento ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertCircle className="size-8 text-danger" />
          <div>
            <h2 className="font-bold text-text">Não foi possível carregar os eventos</h2>
            <p className="mt-1 text-sm text-text-light">Confira sua conexão e tente novamente.</p>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </Card>
      ) : eventos === null ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard className="h-44" />
          <SkeletonCard className="h-44" />
        </div>
      ) : eventos.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Nenhum evento agendado"
            description="Quando o comitê publicar um evento, ele aparecerá aqui."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-text">Próximos eventos</h2>
              <Badge tone="neutral">{plural(futuros.length, "agendado")}</Badge>
            </div>

            {futuros.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarCheck}
                  title="Nenhum próximo evento"
                  description="Os eventos futuros aparecerão aqui."
                />
              </Card>
            ) : (
              (() => {
                const renderCard = (evento: EventoDoc) => (
                  <EventoCard
                    key={evento.id}
                    evento={evento}
                    confirmado={evento.inscritos?.includes(atleta.id) ?? false}
                    alterando={alterandoId === evento.id}
                    bloqueado={alterandoId !== null && alterandoId !== evento.id}
                    somenteVisualizacao={isPreview}
                    onAlternar={() => alternarPresenca(evento)}
                  />
                );
                // Separa o que é da modalidade do atleta do resto, para um evento de
                // outra modalidade não parecer um convite direto.
                if (!minhaModalidade) {
                  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{futuros.map(renderCard)}</div>;
                }
                const meus = futuros.filter(
                  (evento) => evento.modalidade === "ambas" || evento.modalidade === minhaModalidade,
                );
                const outros = futuros.filter((evento) => !meus.includes(evento));
                return (
                  <div className="flex flex-col gap-6">
                    {meus.length > 0 ? (
                      <GrupoEventos titulo={`Da sua modalidade · ${modalidadeLabel[minhaModalidade]}`}>
                        {meus.map(renderCard)}
                      </GrupoEventos>
                    ) : null}
                    {outros.length > 0 ? (
                      <GrupoEventos titulo="Outras modalidades">{outros.map(renderCard)}</GrupoEventos>
                    ) : null}
                  </div>
                );
              })()
            )}
          </section>

          {passados.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-text">Eventos passados</h2>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {passados.map((evento) => (
                  <Card key={evento.id} className="flex items-center gap-4 bg-bg-inset/50">
                    <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[var(--radius)] bg-bg-inset text-text-muted">
                      <span className="text-xs font-bold uppercase">{partesData(evento.data).mes}</span>
                      <span className="text-xl font-black">{partesData(evento.data).dia}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text-light">{evento.titulo}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="neutral">{formatShortDate(evento.data)}</Badge>
                        <Badge tone="neutral">{plural(evento.inscritos?.length ?? 0, "participante")}</Badge>
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
