"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { ArrowRight, Plus, Repeat, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { logAudit } from "@/lib/audit";
import { formatDataTreino } from "@/lib/format";
import { modalidadeLabel } from "@/lib/labels";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { ehModalidade, problemaNasTrocas, sugerirTroca, trocasDoAtleta, type TrocaDeModalidade } from "@/lib/modalidade";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { InlineAlert } from "@/components/ui/InlineAlert";
import type { AtletaDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

const outra = (m: Modalidade): Modalidade => (m === "corrida" ? "bicicleta" : "corrida");
const nome = (m: Modalidade) => modalidadeLabel[m];

/** Grava as trocas no cadastro, registra na auditoria e atualiza o ranking do atleta. */
export async function salvarTrocas(params: { atleta: Pick<AtletaDoc, "id" | "nome">; trocas: TrocaDeModalidade[]; autor: { uid: string; nome: string }; acao: string }) {
  const trocas = [...params.trocas].sort((a, b) => a.data.localeCompare(b.data));
  await updateDoc(doc(db, "atletas", params.atleta.id), { trocasModalidade: trocas, atualizadoEm: serverTimestamp() });
  await logAudit({
    acao: params.acao,
    entidade: "atletas",
    entidadeId: params.atleta.id,
    dados: { nome: params.atleta.nome, trocas: trocas.map((t) => `${t.de}→${t.para} em ${t.data}`) },
    criadoPor: params.autor.uid,
    criadoPorNome: params.autor.nome,
  });
  return atualizarRankingAutomaticamente([params.atleta.id], "troca_modalidade");
}

/**
 * Trocas entre Corrida e Bike, com a data de cada uma. Nas apurações, cada
 * ponto conta na modalidade em que o atleta estava no dia.
 */
export function TrocasModalidade({ atleta }: { atleta: AtletaDoc }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [trocas, setTrocas] = useState<TrocaDeModalidade[]>(() => trocasDoAtleta(atleta));
  const [lancamentos, setLancamentos] = useState<Pick<HistoricoPontoDoc, "equipe" | "dataTreino" | "estornado">[] | null>(null);
  const [nova, setNova] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ indice: number; data: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const atual = ehModalidade(atleta.equipe) ? atleta.equipe : null;

  // Os lançamentos guardam a equipe do dia: servem para sugerir uma troca que ninguém registrou.
  useEffect(() => {
    if (!atual) return;
    let ativo = true;
    getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)))
      .then((snap) => ativo && setLancamentos(snap.docs.map((d) => d.data() as HistoricoPontoDoc)))
      .catch(() => ativo && setLancamentos([]));
    return () => {
      ativo = false;
    };
  }, [atleta.id, atual]);

  const sugestao = useMemo(() => (lancamentos && trocas.length === 0 ? sugerirTroca({ equipe: atleta.equipe, trocasModalidade: [] }, lancamentos) : null), [lancamentos, trocas.length, atleta.equipe]);

  if (!atual) return null;

  /** A troca que se registra agora entra antes da primeira (ou é a única). */
  const primeira = trocas[0];
  const novaPara: Modalidade = primeira ? primeira.de : atual;
  const novaDe = outra(novaPara);

  async function gravar(lista: TrocaDeModalidade[], mensagem: string) {
    const problema = problemaNasTrocas(lista, atleta.equipe);
    if (problema) {
      show("error", problema);
      return false;
    }
    setSalvando(true);
    try {
      const ranking = await salvarTrocas({ atleta, trocas: lista, autor: { uid, nome: autor.nome }, acao: "trocas_modalidade" });
      setTrocas([...lista].sort((a, b) => a.data.localeCompare(b.data)));
      show(ranking ? "success" : "info", ranking ? `${mensagem} Ranking atualizado.` : `${mensagem} O ranking muda na próxima atualização.`);
      return true;
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  const registro = (t: Omit<TrocaDeModalidade, "registradoPor" | "registradoPorNome" | "registradoEm">): TrocaDeModalidade => ({
    ...t,
    registradoPor: uid,
    registradoPorNome: autor.nome,
    registradoEm: new Date().toISOString(),
  });

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-border pt-5" aria-labelledby="trocas-titulo">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Repeat className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h4 id="trocas-titulo" className="text-sm font-bold text-text">
            Trocas de modalidade
          </h4>
          <p className="text-xs text-text-light [text-wrap:pretty]">
            Cada ponto, treino e km conta na modalidade em que {atleta.nome.split(" ")[0]} estava no dia. Assim quem vem da Bike não leva os km para a Corrida.
          </p>
        </div>
      </div>

      {sugestao && nova === null ? (
        <InlineAlert tone="info">
          <div className="flex flex-col gap-2">
            <p>
              Os lançamentos mostram {nome(sugestao.de)} até antes de {formatDataTreino(sugestao.data)} e {nome(sugestao.para)} a partir daí. Parece uma troca que não foi registrada.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={salvando} onClick={() => void gravar([registro(sugestao)], "Troca registrada.")}>
                Registrar a troca em {formatDataTreino(sugestao.data)}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNova(sugestao.data)}>
                Escolher outra data
              </Button>
            </div>
          </div>
        </InlineAlert>
      ) : null}

      {trocas.length > 0 ? (
        <ol className="flex flex-col divide-y divide-border-subtle rounded-[var(--radius)] border border-border">
          {trocas.map((t, i) => (
            <li key={`${t.data}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-text">
                {nome(t.de)}
                <ArrowRight className="size-3.5 shrink-0 text-text-muted" aria-label="para" />
                {nome(t.para)}
                <span className="font-normal text-text-light">desde {formatDataTreino(t.data)}</span>
              </span>
              {editando?.indice === i ? (
                <span className="flex items-end gap-2">
                  <TextField label="Nova data" type="date" value={editando.data} max={dataIsoLocal()} onChange={(e) => setEditando({ indice: i, data: e.target.value })} />
                  <Button
                    size="sm"
                    loading={salvando}
                    onClick={async () => {
                      if (await gravar(trocas.map((x, k) => (k === i ? { ...x, data: editando.data } : x)), "Data da troca alterada.")) setEditando(null);
                    }}
                  >
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </span>
              ) : (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditando({ indice: i, data: t.data })}>
                    Alterar data
                  </Button>
                  {/* Só a mais antiga sai sem quebrar a sequência (as outras dependem dela). */}
                  {i === 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remover a troca de ${formatDataTreino(t.data)}`}
                      onClick={() => void gravar(trocas.slice(1), "Troca removida.")}
                      disabled={salvando}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : !sugestao && nova === null ? (
        <p className="rounded-[var(--radius)] bg-bg-inset/60 px-3 py-2.5 text-sm text-text-light">Sempre na {nome(atual)}. Nenhuma troca registrada.</p>
      ) : null}

      {nova !== null ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-3">
          <p className="text-sm font-semibold text-text">
            {nome(novaDe)} <ArrowRight className="inline size-3.5 text-text-muted" aria-label="para" /> {nome(novaPara)}
          </p>
          <div className="w-48">
            <TextField label={`Primeiro dia na ${nome(novaPara)}`} type="date" value={nova} max={primeira ? primeira.data : dataIsoLocal()} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={salvando}
              onClick={async () => {
                if (await gravar([registro({ de: novaDe, para: novaPara, data: nova }), ...trocas], "Troca registrada.")) setNova(null);
              }}
            >
              Registrar troca
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNova(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="w-fit" onClick={() => setNova(sugestao?.data ?? "")}>
          <Plus className="size-4" aria-hidden="true" />
          {trocas.length > 0 ? `Registrar uma troca anterior (${nome(novaDe)} → ${nome(novaPara)})` : `Registrar troca de ${nome(novaDe)} para ${nome(novaPara)}`}
        </Button>
      )}
    </section>
  );
}
