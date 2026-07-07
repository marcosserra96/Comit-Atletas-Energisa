"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
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
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { equipeLabel, isWaitlisted, modalidadeFromEquipe } from "@/lib/labels";
import { formatLongDate, formatShortDate } from "@/lib/format";
import type { EventoDoc, HistoricoPontoDoc, NoticiaDoc } from "@/lib/types";

export default function DashboardPage() {
  const { atleta } = useActiveSession();
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      try {
        const lancamentosSnap = await getDocs(
          query(
            collection(db, "historico_pontos"),
            where("atletaId", "==", atleta.id),
            orderBy("criadoEm", "desc"),
            limit(5),
          ),
        );
        if (active) {
          setLancamentos(
            lancamentosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc),
          );
        }
      } catch {
        if (active) setLancamentos([]);
      }

      try {
        const eventosSnap = await getDocs(
          query(collection(db, "agenda_eventos"), orderBy("data", "asc"), limit(3)),
        );
        if (active) {
          setEventos(eventosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc));
        }
      } catch {
        if (active) setEventos([]);
      }

      try {
        const noticiasSnap = await getDocs(
          query(collection(db, "noticias"), orderBy("criadoEm", "desc"), limit(3)),
        );
        if (active) {
          setNoticias(noticiasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc));
        }
      } catch {
        if (active) setNoticias([]);
      }
    }

    loadDashboardData();
    return () => {
      active = false;
    };
  }, [atleta.id]);

  const modalidade = modalidadeFromEquipe(atleta.equipe);
  const waitlisted = isWaitlisted(atleta.equipe);
  const ModalidadeIcon = modalidade === "bicicleta" ? Bike : Footprints;

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-text-light">Pontuação total</p>
            <p className="text-xl font-extrabold text-text">{atleta.pontuacaoTotal}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <ModalidadeIcon className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-text-light">Modalidade</p>
            <p className="text-xl font-extrabold text-text">{equipeLabel[atleta.equipe]}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <ListOrdered className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-text-light">Posição no ranking</p>
            <p className="text-xl font-extrabold text-text">
              {modalidade ? "—" : "Sem modalidade"}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
            <History className="size-4 text-text-muted" />
            Últimos lançamentos
          </h3>
          {lancamentos === null ? (
            <div className="flex-1 animate-pulse rounded-[var(--radius)] bg-bg" style={{ minHeight: 120 }} />
          ) : lancamentos.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhum lançamento ainda"
              description="Assim que o comitê lançar pontos, seu histórico aparece aqui."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {lancamentos.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-text">{item.regraDesc}</span>
                  <span
                    className={
                      item.estornado
                        ? "text-text-muted line-through"
                        : "font-bold text-success"
                    }
                  >
                    +{item.pontos} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
            <CalendarCheck className="size-4 text-text-muted" />
            Próximos eventos
          </h3>
          {eventos === null ? (
            <div className="flex-1 animate-pulse rounded-[var(--radius)] bg-bg" style={{ minHeight: 120 }} />
          ) : eventos.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Nenhum evento agendado"
              description="Quando o comitê publicar um evento, ele aparece aqui para inscrição."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {eventos.map((evento) => (
                <li key={evento.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-text">{evento.titulo}</p>
                    <p className="text-xs text-text-light">{evento.local}</p>
                  </div>
                  <span className="text-xs font-semibold text-text-light">
                    {formatShortDate(evento.data)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
