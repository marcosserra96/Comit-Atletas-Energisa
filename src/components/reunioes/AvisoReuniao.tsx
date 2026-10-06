"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { CalendarClock, ExternalLink, UsersRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmarPresenca } from "@/components/reunioes/ConfirmarPresenca";
import { horarioDoEvento } from "@/lib/eventos";
import { faseDaReuniao, idPresencaReuniao, situacaoCheckin } from "@/lib/reunioes";
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
 * Escuta só os eventos do dia (uma consulta pequena): quando o comitê ativa a
 * confirmação, o aviso aparece na hora. O relógio reavalia a janela a cada
 * 15 s e ao voltar para o app.
 */
function useReuniaoAgoraInterna() {
  const { atleta, isPreview } = useAthleteView();
  const [hoje, setHoje] = useState<EventoDoc[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [conferidas, setConferidas] = useState<Set<string>>(new Set());

  useRelogio(setAgora);

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

  const marcarConfirmada = useCallback((id: string) => setConfirmadas((atual) => new Set(atual).add(id)), []);
  const reuniao = abertas.find((e) => conferidas.has(e.id) && !confirmadas.has(e.id)) ?? null;
  // `agora` vai junto: quem usa o contexto re-renderiza no relógio (ex.: o aviso
  // aparece sozinho quando chega o horário de início).
  return { reuniao, marcarConfirmada, agora };
}

/** Atualiza "agora" a cada 15 s e sempre que o app volta a ficar visível. */
export function useRelogio(setAgora: (t: number) => void, intervaloMs = 15_000) {
  useEffect(() => {
    const tique = () => setAgora(Date.now());
    const t = setInterval(tique, intervaloMs);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") tique();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", tique);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", tique);
    };
  }, [setAgora, intervaloMs]);
}

interface ReuniaoAgora {
  reuniao: EventoDoc | null;
  marcarConfirmada: (id: string) => void;
  agora: number;
}

const Contexto = createContext<ReuniaoAgora>({ reuniao: null, marcarConfirmada: () => undefined, agora: 0 });

export function ReuniaoAgoraProvider({ children }: { children: ReactNode }) {
  const valor = useReuniaoAgoraInterna();
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useReuniaoAgora() {
  return useContext(Contexto);
}

/**
 * Aviso "Reunião acontecendo agora": confirma a presença ali mesmo (QR ou
 * código). "Agora não" esconde até fechar o navegador; o botão segue na agenda.
 */
export function AvisoReuniao({ reuniao }: { reuniao: EventoDoc }) {
  const pathname = usePathname();
  const { marcarConfirmada } = useReuniaoAgora();
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
    if (concluida) marcarConfirmada(reuniao.id);
  }

  return (
    <Modal
      open
      onClose={fechar}
      title={faseDaReuniao(reuniao) === "depois" ? "Registre sua presença na reunião" : "Reunião acontecendo agora"}
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
