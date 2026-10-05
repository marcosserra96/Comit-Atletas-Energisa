"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { CalendarClock, ExternalLink, UsersRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmarPresenca } from "@/components/reunioes/ConfirmarPresenca";
import { horarioDoEvento } from "@/lib/eventos";
import { idPresencaReuniao, situacaoCheckin } from "@/lib/reunioes";
import type { EventoDoc } from "@/lib/types";

const CHAVE_DISPENSADA = "reuniao-aviso-dispensado-";

function hojeIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dispensadaNestaSessao(id: string) {
  try {
    return sessionStorage.getItem(CHAVE_DISPENSADA + id) === "1";
  } catch {
    return false;
  }
}

/**
 * Reunião de hoje com a confirmação pelo app aberta e sem presença do atleta.
 * Escuta só os eventos do dia (uma consulta pequena) e reavalia a cada minuto.
 */
export function useReuniaoAgora() {
  const { atleta, isPreview } = useAthleteView();
  const [hoje, setHoje] = useState<EventoDoc[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [conferidas, setConferidas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const dia = useMemo(() => {
    void agora; // vira o dia com o app aberto
    return hojeIsoLocal();
  }, [agora]);

  useEffect(() => {
    if (isPreview) return;
    return onSnapshot(
      query(collection(db, "agenda_eventos"), where("data", "==", dia)),
      (snap) => setHoje(snap.docs.map((d) => ({ ...(d.data() as EventoDoc), id: d.id }))),
      () => setHoje([]),
    );
  }, [dia, isPreview]);

  const abertas = useMemo(() => {
    const momento = new Date(agora);
    return hoje.filter(
      (e) =>
        e.tipo === "reuniao" &&
        (e.modalidade === "ambas" || e.modalidade === atleta.equipe) &&
        situacaoCheckin(e, momento) === "aberto",
    );
  }, [hoje, agora, atleta.equipe]);

  // Presença já registrada (manual ou app)? Doc inexistente nega leitura: conta como não.
  const chave = abertas.map((e) => e.id).join(",");
  useEffect(() => {
    if (!chave) return;
    let ativo = true;
    const ids = chave.split(",");
    Promise.all(
      ids.map((id) =>
        getDoc(doc(db, "historico_pontos", idPresencaReuniao(id, atleta.id)))
          .then((s) => (s.exists() ? id : null))
          .catch(() => null),
      ),
    ).then((resultado) => {
      if (!ativo) return;
      setConfirmadas(new Set(resultado.filter((x): x is string => x !== null)));
      setConferidas(new Set(ids));
    });
    return () => {
      ativo = false;
    };
  }, [chave, atleta.id]);

  return abertas.find((e) => conferidas.has(e.id) && !confirmadas.has(e.id)) ?? null;
}

/**
 * Aviso "Reunião acontecendo agora": confirma a presença ali mesmo (QR ou
 * código). "Agora não" esconde até fechar o navegador; o botão segue na agenda.
 */
export function AvisoReuniao({ reuniao }: { reuniao: EventoDoc }) {
  const pathname = usePathname();
  const [dispensada, setDispensada] = useState(() => dispensadaNestaSessao(reuniao.id));
  const [concluida, setConcluida] = useState(false);

  if (dispensada || pathname.startsWith("/presenca")) return null;

  function fechar() {
    try {
      sessionStorage.setItem(CHAVE_DISPENSADA + reuniao.id, "1");
    } catch {
      // Sem armazenamento: some só nesta tela.
    }
    setDispensada(true);
  }

  return (
    <Modal
      open
      onClose={fechar}
      title="Reunião acontecendo agora"
      footer={
        <Button variant="ghost" onClick={fechar} className="w-full sm:w-auto">
          {concluida ? "Fechar" : "Agora não"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-accent-subtle text-accent">
            <UsersRound className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold text-text">{reuniao.titulo}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-light">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              Hoje · {horarioDoEvento(reuniao)}
              {reuniao.local ? ` · ${reuniao.local}` : ""}
            </p>
            {reuniao.linkOnline ? (
              <a
                href={reuniao.linkOnline}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Entrar na reunião online
              </a>
            ) : null}
          </div>
        </div>
        <ConfirmarPresenca eventoId={reuniao.id} onConcluido={() => setConcluida(true)} />
      </div>
    </Modal>
  );
}
