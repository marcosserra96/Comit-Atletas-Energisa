"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { ClipboardList, Clock } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { Modal } from "@/components/ui/Modal";
import { useRelogio } from "@/components/reunioes/AvisoReuniao";
import { Button } from "@/components/ui/Button";
import { plural } from "@/lib/format";
import {
  formatarDataHora,
  pesquisaParaEquipe,
  situacaoPesquisa,
  type PesquisaDoc,
} from "@/lib/pesquisas";

interface PesquisasDoAtleta {
  /** Publicadas para a equipe do atleta (abertas, agendadas e encerradas). */
  pesquisas: PesquisaDoc[];
  /** Ids das pesquisas que o atleta já respondeu. */
  respondidas: Set<string>;
  /** Abertas e ainda sem resposta. */
  pendentes: PesquisaDoc[];
  carregando: boolean;
  marcarRespondida: (id: string) => void;
}

const Contexto = createContext<PesquisasDoAtleta>({
  pesquisas: [],
  respondidas: new Set(),
  pendentes: [],
  carregando: true,
  marcarRespondida: () => undefined,
});

export function usePesquisasDoAtleta() {
  return useContext(Contexto);
}

export function PesquisasAtletaProvider({ children }: { children: ReactNode }) {
  const { atleta } = useAthleteView();
  const [todas, setTodas] = useState<PesquisaDoc[] | null>(null);
  const [respondidas, setRespondidas] = useState<Set<string>>(new Set());
  const [agora, setAgora] = useState(() => Date.now());

  // Abertura e fechamento acontecem com o app aberto: o relógio reavalia a
  // cada 15 s e ao voltar para o app; publicar/alterar chega pelo listener.
  useRelogio(setAgora);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "pesquisas"), where("publicada", "==", true)),
        (snap) => setTodas(snap.docs.map((d) => ({ ...(d.data() as PesquisaDoc), id: d.id }))),
        () => setTodas([]),
      ),
    [],
  );

  const pesquisas = useMemo(
    () => (todas ?? []).filter((p) => pesquisaParaEquipe(p, atleta.equipe)),
    [todas, atleta.equipe],
  );

  // Uma leitura por pesquisa: a resposta tem o id do atleta.
  const chave = pesquisas.map((p) => p.id).join(",");
  useEffect(() => {
    if (!chave) return;
    let ativo = true;
    Promise.all(
      chave.split(",").map((id) =>
        getDoc(doc(db, "pesquisas", id, "respostas", atleta.id))
          .then((s) => (s.exists() ? id : null))
          .catch(() => null),
      ),
    ).then((ids) => {
      if (ativo) setRespondidas(new Set(ids.filter((x): x is string => x !== null)));
    });
    return () => {
      ativo = false;
    };
  }, [chave, atleta.id]);

  const marcarRespondida = useCallback(
    (id: string) => setRespondidas((atual) => new Set(atual).add(id)),
    [],
  );

  const valor = useMemo<PesquisasDoAtleta>(() => {
    const momento = new Date(agora);
    return {
      pesquisas,
      respondidas,
      pendentes: pesquisas
        .filter((p) => situacaoPesquisa(p, momento) === "aberta" && !respondidas.has(p.id))
        .sort((a, b) => a.fechaEm.localeCompare(b.fechaEm)),
      carregando: todas === null,
      marcarRespondida,
    };
  }, [pesquisas, respondidas, agora, todas, marcarRespondida]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

const CHAVE_ADIADA = "pesquisa-adiada-";

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function adiadaHoje(id: string) {
  try {
    return localStorage.getItem(CHAVE_ADIADA + id) === hojeLocal();
  } catch {
    return false;
  }
}

/**
 * Aviso ao abrir o portal: a pesquisa aberta mais próxima de fechar. "Depois"
 * esconde o aviso até o dia seguinte; a pesquisa segue no menu Pesquisas.
 */
export function AvisoPesquisa() {
  const { pendentes } = usePesquisasDoAtleta();
  const { isPreview, withPreview } = useAthleteView();
  const pathname = usePathname();
  const router = useRouter();
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set());

  const pesquisa = pendentes.find((p) => !dispensadas.has(p.id) && !adiadaHoje(p.id));
  const aberto = Boolean(pesquisa) && !isPreview && !pathname.startsWith("/pesquisas");
  if (!pesquisa) return null;

  function depois() {
    if (!pesquisa) return;
    try {
      localStorage.setItem(CHAVE_ADIADA + pesquisa.id, hojeLocal());
    } catch {
      // Sem armazenamento: some só nesta visita.
    }
    setDispensadas((atual) => new Set(atual).add(pesquisa.id));
  }

  return (
    <Modal
      open={aberto}
      onClose={depois}
      title="Tem uma pesquisa para você"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={depois}>
            Depois
          </Button>
          <Button
            onClick={() => {
              setDispensadas((atual) => new Set(atual).add(pesquisa.id));
              router.push(withPreview(`/pesquisas/${pesquisa.id}`));
            }}
          >
            Responder agora
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-primary-subtle text-primary">
          <ClipboardList className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold text-text">{pesquisa.titulo}</p>
          {pesquisa.descricao ? <p className="mt-1 text-sm text-text-light">{pesquisa.descricao}</p> : null}
          <p className="mt-3 flex items-center gap-1.5 text-sm text-text-light">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {plural(pesquisa.perguntas.length, "pergunta")} · responda até {formatarDataHora(pesquisa.fechaEm)}
          </p>
        </div>
      </div>
    </Modal>
  );
}
