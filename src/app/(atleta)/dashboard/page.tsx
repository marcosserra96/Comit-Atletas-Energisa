"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Trophy,
  Bike,
  Footprints,
  ListOrdered,
  History,
  CalendarCheck,
  Newspaper,
  Sparkles,
  Users,
  MapPin,
  Check,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isWaitlisted, modalidadeFromEquipe } from "@/lib/labels";
import { formatDataTreino, formatLongDate, formatShortDate } from "@/lib/format";
import { calcularInsightsAtleta } from "@/lib/athleteStats";
import type { AtletaDoc, EventoDoc, HistoricoPontoDoc, NoticiaDoc } from "@/lib/types";

export default function DashboardPage() {
  const { atleta } = useActiveSession();
  const { show } = useToast();
  const modalidade = modalidadeFromEquipe(atleta.equipe);
  const waitlisted = isWaitlisted(atleta.equipe);
  const ModalidadeIcon = modalidade === "bicicleta" ? Bike : Footprints;

  const [companheiros, setCompanheiros] = useState<AtletaDoc[] | null>(() => (modalidade ? null : []));
  const [meusLancamentos, setMeusLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [proximoEvento, setProximoEvento] = useState<EventoDoc[] | null>(null);
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);
  const [inscrevendo, setInscrevendo] = useState(false);

  useEffect(() => {
    if (!modalidade) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("equipe", "==", atleta.equipe), orderBy("pontuacaoTotal", "desc")),
      (snap) => setCompanheiros(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setCompanheiros([]),
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- modalidade deriva de atleta.equipe, mesma dependência
  }, [atleta.equipe]);

  useEffect(() => {
    let active = true;

    getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)))
      .then((snap) => {
        if (active) setMeusLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
      })
      .catch(() => {
        if (active) setMeusLancamentos([]);
      });

    getDocs(query(collection(db, "noticias"), orderBy("criadoEm", "desc"), limit(3)))
      .then((snap) => {
        if (active) setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc));
      })
      .catch(() => {
        if (active) setNoticias([]);
      });

    return () => {
      active = false;
    };
  }, [atleta.id]);

  useEffect(() => {
    const isoHoje = new Date().toISOString().slice(0, 10);
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), where("data", ">=", isoHoje), orderBy("data", "asc"), limit(1)),
      (snap) => setProximoEvento(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
      () => setProximoEvento([]),
    );
    return unsubscribe;
  }, []);

  const insights = useMemo(() => {
    if (companheiros === null || meusLancamentos === null) return null;
    return calcularInsightsAtleta({ atleta, companheiros, meusLancamentos });
  }, [atleta, companheiros, meusLancamentos]);

  const ultimosLancamentos = useMemo(
    () => [...(meusLancamentos ?? [])].sort((a, b) => b.dataTreino.localeCompare(a.dataTreino)).slice(0, 5),
    [meusLancamentos],
  );

  const evento = proximoEvento?.[0];
  const jaConfirmado = !!evento?.inscritos?.includes(atleta.id);

  async function handleRsvp() {
    if (!evento) return;
    setInscrevendo(true);
    try {
      await updateDoc(doc(db, "agenda_eventos", evento.id), {
        inscritos: jaConfirmado ? arrayRemove(atleta.id) : arrayUnion(atleta.id),
      });
      show("success", jaConfirmado ? "Presença cancelada." : "Presença confirmada!");
    } catch {
      show("error", "Não foi possível atualizar agora. Tente novamente.");
    } finally {
      setInscrevendo(false);
    }
  }

  const maxSerie = Math.max(1, ...(insights?.seriesMensal.map((s) => s.pontos) ?? [1]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-text">
            Olá, {atleta.nome.split(" ")[0]} 👋
          </h2>
          <p className="text-sm text-text-light capitalize">{formatLongDate(new Date())}</p>
        </div>
        <Badge tone={waitlisted ? "warning" : atleta.ativo ? "success" : "neutral"}>
          {waitlisted ? "Na fila de espera" : atleta.ativo ? "Ativo no programa" : "Inativo"}
        </Badge>
      </div>

      {insights && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-primary/20 bg-primary/[0.04] p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm leading-snug text-text">{insights.leitura}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-light">Pontuação total</p>
            <p className="text-xl font-extrabold text-text">{atleta.pontuacaoTotal}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <ListOrdered className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-light">Posição no ranking</p>
            <p className="text-xl font-extrabold text-text">
              {!modalidade ? "—" : insights?.posicao ? `${insights.posicao}º` : "…"}
            </p>
            {modalidade && insights && insights.totalNoRanking > 0 && (
              <p className="text-[.7rem] text-text-light">de {insights.totalNoRanking}</p>
            )}
          </div>
        </Card>

        <Card className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <ModalidadeIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-light">Km no mês</p>
            <p className="text-xl font-extrabold text-text">{insights ? insights.kmMes.toFixed(1) : "…"}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-light">Vs. média da equipe</p>
            <p className="text-xl font-extrabold text-text">
              {insights?.vsMediaEquipePct === null || insights?.vsMediaEquipePct === undefined
                ? "—"
                : `${insights.vsMediaEquipePct > 0 ? "+" : ""}${insights.vsMediaEquipePct}%`}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="flex flex-col">
          <h3 className="mb-0.5 text-sm font-bold text-text">Sua evolução</h3>
          <p className="mb-3.5 text-xs text-text-light">Pontos por mês, últimos 6 meses</p>
          <div className="flex h-[130px] items-end gap-3">
            {(insights?.seriesMensal ?? []).map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end">
                  <div
                    className="w-full rounded-t-[var(--radius-sm)] transition-all"
                    style={{
                      height: `${Math.max(4, (s.pontos / maxSerie) * 100)}%`,
                      backgroundColor: s.pontos > 0 ? "var(--color-primary)" : "var(--color-border)",
                    }}
                    title={`${s.pontos} pontos`}
                  />
                </div>
                <span className="text-[.7rem] font-semibold uppercase text-text-light">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
            <CalendarCheck className="size-4 text-text-muted" />
            Próximo evento
          </h3>
          {proximoEvento === null ? (
            <div className="flex-1 animate-pulse rounded-[var(--radius)] bg-bg" style={{ minHeight: 100 }} />
          ) : !evento ? (
            <EmptyState
              icon={CalendarCheck}
              title="Nenhum evento agendado"
              description="Quando o comitê publicar um evento, ele aparece aqui."
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <p className="font-semibold text-text">{evento.titulo}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-light">
                <CalendarCheck className="size-3.5" />
                {formatShortDate(evento.data)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-text-light">
                <MapPin className="size-3.5" />
                {evento.local}
              </p>
              <Button
                variant={jaConfirmado ? "secondary" : "primary"}
                className="mt-4 justify-center"
                onClick={handleRsvp}
                loading={inscrevendo}
              >
                {jaConfirmado ? (
                  <>
                    <Check className="size-4" />
                    Presença confirmada
                  </>
                ) : (
                  "Confirmar presença"
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="flex flex-col">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
          <History className="size-4 text-text-muted" />
          Últimos lançamentos
        </h3>
        {meusLancamentos === null ? (
          <div className="animate-pulse rounded-[var(--radius)] bg-bg" style={{ minHeight: 120 }} />
        ) : ultimosLancamentos.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhum lançamento ainda"
            description="Assim que o comitê lançar pontos, seu histórico aparece aqui."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {ultimosLancamentos.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="text-text">{item.regraDesc}</span>
                  <span className="ml-2 text-xs text-text-light">{formatDataTreino(item.dataTreino, item.dataAproximada)}</span>
                </div>
                <span className={item.estornado ? "text-text-muted line-through" : "font-bold text-success"}>
                  +{item.pontos} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
          <Newspaper className="size-4 text-text-muted" />
          Notícias recentes
        </h3>
        {noticias === null ? (
          <div className="animate-pulse rounded-[var(--radius)] bg-bg" style={{ minHeight: 80 }} />
        ) : noticias.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="Nenhuma notícia publicada"
            description="Comunicados do comitê vão aparecer aqui assim que forem publicados."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {noticias.map((noticia) => (
              <li key={noticia.id} className="py-3">
                <p className="text-sm font-semibold text-text">{noticia.titulo}</p>
                <p className="text-xs text-text-light">{noticia.resumo}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
