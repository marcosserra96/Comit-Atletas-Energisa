"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Copy, Flag, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { temPermissao } from "@/lib/permissoes";
import { dataIsoLocal } from "@/lib/date";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import {
  agruparPorAtleta,
  diasRestantes,
  participacaoNoDesafio,
  statusDoDesafio,
  textoMetaGestao,
  textoPeriodo,
  type DesafioDoc,
  type StatusDesafio,
} from "@/lib/desafios";
import { excluirDesafio, listarDesafios, type RascunhoDesafio } from "@/lib/desafiosCliente";
import { plural } from "@/lib/format";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { Medalha } from "@/components/conquistas/Medalha";
import { DesafioModal, mesInteiro, rascunhoPadrao } from "./DesafioModal";
import { ParticipantesModal } from "./ParticipantesModal";

const SECOES: { status: StatusDesafio; titulo: string }[] = [
  { status: "ativo", titulo: "Em andamento" },
  { status: "agendado", titulo: "Agendados" },
  { status: "encerrado", titulo: "Encerrados" },
];

const MODALIDADE_LABEL: Record<DesafioDoc["modalidade"], string> = { todas: "Corrida e Bike", corrida: "Corrida", bicicleta: "Bike" };

function semId(d: DesafioDoc): RascunhoDesafio {
  return { titulo: d.titulo, modalidade: d.modalidade, tipo: d.tipo, metas: d.metas, inicio: d.inicio, fim: d.fim, icone: d.icone, nivel: d.nivel };
}

export default function DesafiosPage() {
  const { usuario } = useActiveSession();
  const pode = temPermissao(usuario, "regras");
  const { show } = useToast();
  const regrasTreino = useRegrasDeTreino();
  const [desafios, setDesafios] = useState<DesafioDoc[] | null>(null);
  const [erro, setErro] = useState("");
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [formulario, setFormulario] = useState<{ chave: number; inicial: RascunhoDesafio } | null>(null);
  const [excluindo, setExcluindo] = useState<DesafioDoc | null>(null);
  const [vendo, setVendo] = useState<DesafioDoc | null>(null);

  const carregar = useCallback(() => {
    listarDesafios().then(
      (lista) => {
        setDesafios(lista);
        setErro("");
      },
      (e: Error) => setErro(e.message),
    );
  }, []);

  useEffect(() => {
    if (!pode) return;
    carregar();
    const unsub = onSnapshot(collection(db, "atletas"), (snap) => setAtletas(snap.docs.map((d) => ({ ...(d.data() as AtletaDoc), id: d.id }))));
    carregarTodosLancamentos().then(setLancamentos, () => setLancamentos([]));
    return unsub;
  }, [pode, carregar]);

  const hoje = dataIsoLocal();
  const porAtleta = useMemo(() => (lancamentos ? agruparPorAtleta(lancamentos) : null), [lancamentos]);

  const participacao = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof participacaoNoDesafio<AtletaDoc>>>();
    if (!desafios || !atletas || !porAtleta || !regrasTreino) return mapa;
    for (const d of desafios) mapa.set(d.id, participacaoNoDesafio({ desafio: d, atletas, porAtleta, regrasTreino, hoje }));
    return mapa;
  }, [desafios, atletas, porAtleta, regrasTreino, hoje]);

  if (!pode) return <NotAuthorized />;

  const abrirNovo = (inicial: RascunhoDesafio = rascunhoPadrao()) => setFormulario({ chave: Date.now(), inicial });

  async function excluir() {
    if (!excluindo) return;
    try {
      await excluirDesafio(excluindo.id);
      show("success", "Desafio excluído.");
      setExcluindo(null);
      carregar();
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível excluir agora. Tente novamente.");
    }
  }

  const grupos = SECOES.map((s) => ({
    ...s,
    itens: (desafios ?? [])
      .filter((d) => statusDoDesafio(d, hoje) === s.status)
      .sort((a, b) => (s.status === "encerrado" ? b.fim.localeCompare(a.fim) : a.inicio.localeCompare(b.inicio))),
  })).filter((g) => g.itens.length > 0);

  const concluidosDoExcluido = excluindo ? (participacao.get(excluindo.id)?.concluidos ?? 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Desafios"
        subtitle="Metas com prazo que viram medalha para quem completar. O progresso é calculado com os pontos lançados."
        icon={Flag}
        actions={
          <Button onClick={() => abrirNovo()}>
            <Plus className="size-4" aria-hidden="true" />
            Novo desafio
          </Button>
        }
      />

      {erro ? <InlineAlert tone="danger">{erro}</InlineAlert> : null}

      {desafios === null && !erro ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-52 animate-pulse" />
          <Card className="h-52 animate-pulse" />
        </div>
      ) : desafios && desafios.length === 0 ? (
        <Card>
          <EmptyState
            icon={Flag}
            title="Nenhum desafio ainda"
            description="Crie uma meta com prazo, como 40 km em outubro ou um treino por semana no trimestre. Quem completar ganha a medalha e recebe o aviso no celular."
            action={
              <Button onClick={() => abrirNovo()}>
                <Plus className="size-4" aria-hidden="true" />
                Criar o primeiro desafio
              </Button>
            }
          />
        </Card>
      ) : (
        grupos.map((g) => (
          <section key={g.status} aria-labelledby={`secao-${g.status}`} className="flex flex-col gap-3">
            <h2 id={`secao-${g.status}`} className="text-md font-bold text-text">
              {g.titulo} <span className="font-semibold text-text-muted">{g.itens.length}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {g.itens.map((d) => {
                const p = participacao.get(d.id);
                const total = p?.participantes.length ?? 0;
                const concluidos = p?.concluidos ?? 0;
                const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
                const dias = diasRestantes(d, hoje);
                return (
                  <Card key={d.id} className="flex flex-col gap-4">
                    <div className="flex items-start gap-3.5">
                      <Medalha icone={d.icone} nivel={d.nivel} conquistada tamanho={56} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-tight text-text">{d.titulo}</p>
                        <p className="mt-0.5 text-sm text-text-light">{textoPeriodo(d)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone="neutral">{MODALIDADE_LABEL[d.modalidade]}</Badge>
                          <Badge tone="neutral">{textoMetaGestao(d)}</Badge>
                        </div>
                      </div>
                      {g.status === "ativo" ? (
                        <Badge tone={dias <= 3 ? "accent" : "primary"} className="shrink-0 tabular-nums">
                          {dias === 1 ? "Último dia" : `${dias} dias`}
                        </Badge>
                      ) : null}
                    </div>

                    {g.status === "agendado" ? (
                      <p className="text-sm text-text-muted">Começa em {textoPeriodo({ inicio: d.inicio, fim: d.inicio })}. Os atletas já veem o desafio no Início.</p>
                    ) : p ? (
                      <div>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-text-light">{g.status === "encerrado" ? "Completaram" : "Já completaram"}</span>
                          <span className="font-semibold tabular-nums text-text">
                            {concluidos} de {plural(total, "atleta")} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-inset">
                          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-[42px] animate-pulse rounded-[var(--radius)] bg-bg-inset" aria-hidden="true" />
                    )}

                    <div className="-mx-2 mt-auto flex flex-wrap gap-1 border-t border-border pt-2">
                      {g.status !== "agendado" ? (
                        <Button size="sm" variant="ghost" onClick={() => setVendo(d)} disabled={!p}>
                          <UsersRound className="size-4" aria-hidden="true" />
                          Atletas
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setFormulario({ chave: Date.now(), inicial: { ...semId(d), id: d.id } })}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => abrirNovo({ ...semId(d), titulo: `${d.titulo} (cópia)`.slice(0, 40), ...mesInteiro(1) })}>
                        <Copy className="size-4" aria-hidden="true" />
                        Duplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-danger hover:bg-danger/10"
                        onClick={() => setExcluindo(d)}
                        aria-label={`Excluir “${d.titulo}”`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}

      {formulario ? (
        <DesafioModal
          key={formulario.chave}
          aberto
          inicial={formulario.inicial}
          onFechar={() => setFormulario(null)}
          onSalvo={() => {
            setFormulario(null);
            carregar();
          }}
        />
      ) : null}

      <ParticipantesModal desafio={vendo} participacao={vendo ? participacao.get(vendo.id) ?? null : null} hoje={hoje} onFechar={() => setVendo(null)} />

      <ConfirmActionModal
        open={excluindo !== null}
        title="Excluir desafio"
        description={
          concluidosDoExcluido > 0
            ? `${plural(concluidosDoExcluido, "atleta já ganhou", "atletas já ganharam")} a medalha de “${excluindo?.titulo ?? ""}”. Excluir tira essa medalha de todos. Não dá para desfazer.`
            : `Excluir “${excluindo?.titulo ?? ""}”? Não dá para desfazer.`
        }
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
      />
    </div>
  );
}
