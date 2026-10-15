"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { contarVotos } from "@/lib/enquete";
import { situacaoPesquisa, type PesquisaDoc, type RespostaPesquisaDoc } from "@/lib/pesquisas";
import type { EstadoEnquete } from "@/components/reuniao/SlidesReuniao";

/**
 * Votos ao vivo das enquetes abertas pela reunião (uma escuta por pesquisa).
 * `enquetes`: id da pesquisa → opções mostradas no slide.
 */
export function useEnquetes(enquetes: { pesquisaId: string; opcoes: string[] }[]) {
  const chave = enquetes.map((e) => `${e.pesquisaId}:${e.opcoes.join("|")}`).join(";");
  const [pesquisas, setPesquisas] = useState<Record<string, PesquisaDoc | null>>({});
  const [respostas, setRespostas] = useState<Record<string, Pick<RespostaPesquisaDoc, "respostas">[]>>({});
  const [agora, setAgora] = useState(() => Date.now());

  const ids = useMemo(() => [...new Set(chave ? chave.split(";").map((p) => p.split(":")[0]) : [])], [chave]);

  useEffect(() => {
    const desligar = ids.flatMap((id) => [
      onSnapshot(
        doc(db, "pesquisas", id),
        (snap) => {
          setAgora(Date.now());
          setPesquisas((m) => ({ ...m, [id]: snap.exists() ? ({ ...(snap.data() as PesquisaDoc), id }) : null }));
        },
        () => setPesquisas((m) => ({ ...m, [id]: null })),
      ),
      onSnapshot(
        collection(db, "pesquisas", id, "respostas"),
        (snap) => setRespostas((m) => ({ ...m, [id]: snap.docs.map((d) => d.data() as RespostaPesquisaDoc) })),
        () => setRespostas((m) => ({ ...m, [id]: [] })),
      ),
    ]);
    return () => desligar.forEach((f) => f());
  }, [ids]);

  // A votação fecha sozinha no horário: o relógio confere a cada 15 s.
  useEffect(() => {
    if (ids.length === 0) return;
    const t = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [ids.length]);

  return useMemo(() => {
    const out: Record<string, EstadoEnquete & { pesquisa: PesquisaDoc | null }> = {};
    for (const e of enquetes) {
      const p = pesquisas[e.pesquisaId] ?? null;
      const s = p ? situacaoPesquisa(p, new Date(agora)) : "encerrada";
      out[e.pesquisaId] = {
        ...contarVotos(e.opcoes, respostas[e.pesquisaId] ?? []),
        situacao: s === "aberta" ? "aberta" : s === "agendada" ? "nova" : "encerrada",
        pesquisa: p,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, pesquisas, respostas, agora]);
}
