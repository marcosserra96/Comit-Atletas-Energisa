"use client";

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
import { AlertCircle, CalendarCheck, Check, MapPin, RefreshCw, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SportBadge } from "@/components/ui/SportBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatShortDate } from "@/lib/format";
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

export default function EventosAtletaPage() {
  const { atleta } = useActiveSession();
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
              <Badge tone="neutral">{futuros.length} agendado(s)</Badge>
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
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {futuros.map((evento) => {
                  const data = partesData(evento.data);
                  const confirmado = evento.inscritos?.includes(atleta.id) ?? false;
                  const inscritos = evento.inscritos?.length ?? 0;

                  return (
                    <Card
                      key={evento.id}
                      className="flex flex-col gap-4 transition-colors hover:border-primary/40 sm:flex-row"
                    >
                      <div className="flex items-center gap-4 sm:block">
                        <div className="flex size-18 shrink-0 flex-col items-center justify-center rounded-[var(--radius-lg)] bg-primary/10 text-primary">
                          <span className="text-[11px] font-bold uppercase">{data.mes}</span>
                          <span className="text-2xl font-black leading-none">{data.dia}</span>
                        </div>
                        <div className="sm:hidden">
                          <p className="font-bold text-text">{evento.titulo}</p>
                          <p className="mt-1 text-xs text-text-light">{formatShortDate(evento.data)}</p>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="hidden sm:block">
                          <p className="text-lg font-bold text-text">{evento.titulo}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-light">
                            <MapPin className="size-4 shrink-0" />
                            <span className="truncate">{evento.local}</span>
                          </p>
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-text-light sm:hidden">
                          <MapPin className="size-4 shrink-0" />
                          <span className="truncate">{evento.local}</span>
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {evento.modalidade === "ambas" ? (
                            <Badge tone="neutral">Todas as modalidades</Badge>
                          ) : (
                            <SportBadge modalidade={evento.modalidade} size="sm" />
                          )}
                          {evento.km ? <Badge tone="neutral">{evento.km} km</Badge> : null}
                          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                            <Users className="size-3.5" />
                            {inscritos} confirmado(s)
                          </span>
                          {confirmado && (
                            <Badge tone="success">
                              <Check className="mr-1 size-3" />
                              Você confirmou
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 sm:mt-auto sm:flex sm:justify-end sm:pt-4">
                          <Button
                            size="sm"
                            variant={confirmado ? "secondary" : "primary"}
                            className="w-full justify-center sm:w-auto"
                            loading={alterandoId === evento.id}
                            disabled={alterandoId !== null && alterandoId !== evento.id}
                            onClick={() => alternarPresenca(evento)}
                          >
                            {confirmado ? "Cancelar presença" : "Confirmar presença"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {passados.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-text-muted">Eventos passados</h2>
              <div className="grid grid-cols-1 gap-4 opacity-75 xl:grid-cols-2">
                {passados.map((evento) => (
                  <Card key={evento.id} className="flex items-center gap-4 bg-bg-inset/50">
                    <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[var(--radius)] bg-bg-inset text-text-muted">
                      <span className="text-[10px] font-bold uppercase">{partesData(evento.data).mes}</span>
                      <span className="text-xl font-black">{partesData(evento.data).dia}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text-muted">{evento.titulo}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="neutral">{formatShortDate(evento.data)}</Badge>
                        <Badge tone="neutral">{evento.inscritos?.length ?? 0} participante(s)</Badge>
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
