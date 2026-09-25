"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Repeat2,
  Search,
  Square,
  X,
  XCircle,
} from "lucide-react";
import {
  analisarJustificativaAusencia,
  encerrarJustificativaAusencia,
} from "@/lib/justificativasAusenciaClient";
import {
  motivoAusenciaLabel,
  resumoPeriodicidade,
  statusJustificativaLabel,
} from "@/lib/justificativasAusencia";
import { equipeLabel } from "@/lib/labels";
import { formatDataTreino, formatDateTime } from "@/lib/format";
import { dataIsoLocal } from "@/lib/date";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import type {
  JustificativaAusenciaDoc,
  StatusJustificativaAusencia,
} from "@/lib/types";

type FiltroStatus = "todas" | StatusJustificativaAusencia;

function tomStatus(status: StatusJustificativaAusencia) {
  if (status === "aprovada") return "success" as const;
  if (status === "recusada") return "danger" as const;
  if (status === "pendente") return "warning" as const;
  return "neutral" as const;
}

function IconeStatus({ status }: { status: StatusJustificativaAusencia }) {
  if (status === "aprovada") return <CheckCircle2 className="size-4" aria-hidden="true" />;
  if (status === "recusada") return <XCircle className="size-4" aria-hidden="true" />;
  if (status === "pendente") return <Clock3 className="size-4" aria-hidden="true" />;
  return <CalendarOff className="size-4" aria-hidden="true" />;
}

function periodoJustificativa(item: JustificativaAusenciaDoc) {
  const inicio = formatDataTreino(item.inicio);
  if (item.semDataFinal || !item.fim) return `Desde ${inicio} · sem data final`;
  if (item.fim === item.inicio) return inicio;
  return `${inicio} a ${formatDataTreino(item.fim)}`;
}

function podeEncerrar(item: JustificativaAusenciaDoc) {
  return item.status === "aprovada" &&
    (item.semDataFinal || !item.fim || item.fim >= dataIsoLocal());
}

function AnaliseModal({
  alvo,
  decisao,
  onClose,
  onSaved,
}: {
  alvo: JustificativaAusenciaDoc | null;
  decisao: "aprovada" | "recusada";
  onClose: () => void;
  onSaved: (item: JustificativaAusenciaDoc) => void;
}) {
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!alvo) return;
    if (decisao === "recusada" && observacao.trim().length < 3) {
      setErro("Informe o motivo da recusa para o atleta.");
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      const atualizado = await analisarJustificativaAusencia(
        alvo.id,
        decisao,
        observacao.trim(),
      );
      onSaved(atualizado);
      setObservacao("");
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={alvo !== null}
      onClose={onClose}
      title={decisao === "aprovada" ? "Aprovar justificativa" : "Recusar justificativa"}
      description={
        alvo
          ? `${alvo.atletaNome} · ${periodoJustificativa(alvo)}`
          : undefined
      }
      size="md"
      mobileSheet
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {alvo ? (
          <div className="rounded-[var(--radius)] bg-bg-inset p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
              {motivoAusenciaLabel[alvo.motivo]}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text-light">{alvo.descricao}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="observacao-comite" className="text-sm font-medium text-text">
              {decisao === "recusada" ? "Motivo da recusa" : "Observação ao atleta (opcional)"}
            </label>
            <span className="text-xs text-text-muted">{observacao.length}/1000</span>
          </div>
          <textarea
            id="observacao-comite"
            value={observacao}
            onChange={(event) => setObservacao(event.target.value.slice(0, 1000))}
            rows={4}
            maxLength={1000}
            required={decisao === "recusada"}
            placeholder={
              decisao === "recusada"
                ? "Explique por que a solicitação não foi aprovada."
                : "Ex.: Aprovado para o período informado."
            }
            className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3.5 py-3 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
          />
          {erro ? <p role="alert" className="text-xs font-medium text-danger">{erro}</p> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="submit"
            variant={decisao === "recusada" ? "danger" : "primary"}
            loading={salvando}
          >
            {decisao === "aprovada" ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
            {decisao === "aprovada" ? "Confirmar aprovação" : "Confirmar recusa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function JustificativasTab({
  items,
  erro,
  onRetry,
  onUpdate,
}: {
  items: JustificativaAusenciaDoc[] | null;
  erro: boolean;
  onRetry: () => void;
  onUpdate: (item: JustificativaAusenciaDoc) => void;
}) {
  const { show } = useToast();
  const [filtro, setFiltro] = useState<FiltroStatus>("pendente");
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState<JustificativaAusenciaDoc | null>(null);
  const [decisao, setDecisao] = useState<"aprovada" | "recusada">("aprovada");
  const [encerrando, setEncerrando] = useState<JustificativaAusenciaDoc | null>(null);
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (items ?? []).filter((item) => {
      if (filtro !== "todas" && item.status !== filtro) return false;
      if (!termo) return true;
      return [item.atletaNome, item.descricao, motivoAusenciaLabel[item.motivo]]
        .some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [busca, filtro, items]);

  function abrirAnalise(item: JustificativaAusenciaDoc, novaDecisao: "aprovada" | "recusada") {
    setDecisao(novaDecisao);
    setAlvo(item);
  }

  function handleSaved(item: JustificativaAusenciaDoc) {
    onUpdate(item);
    setAlvo(null);
    show(
      "success",
      item.status === "aprovada"
        ? "Justificativa aprovada e pronta para os lançamentos."
        : "Justificativa recusada. O atleta verá o motivo informado.",
    );
  }

  async function handleEncerrar() {
    if (!encerrando) return;
    setSalvandoEncerramento(true);
    try {
      const atualizado = await encerrarJustificativaAusencia(encerrando.id);
      onUpdate(atualizado);
      setEncerrando(null);
      show("success", "Justificativa encerrada para os próximos treinos.");
    } catch (error) {
      show(
        "error",
        error instanceof Error ? error.message : "Não foi possível encerrar agora.",
      );
    } finally {
      setSalvandoEncerramento(false);
    }
  }

  const filtros: Array<{ value: FiltroStatus; label: string }> = [
    { value: "pendente", label: "Pendentes" },
    { value: "aprovada", label: "Aprovadas" },
    { value: "recusada", label: "Recusadas" },
    { value: "cancelada", label: "Canceladas" },
    { value: "encerrada", label: "Encerradas" },
    { value: "todas", label: "Todas" },
  ];

  if (erro) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="size-9 text-danger" aria-hidden="true" />
        <div>
          <p className="font-bold text-text">Não foi possível carregar as justificativas</p>
          <p className="mt-1 text-sm text-text-light">Tente novamente antes de fazer os lançamentos.</p>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-bold text-text">Solicitações dos atletas</h3>
          <p className="text-sm text-text-light">
            Ao aprovar, o período será reconhecido automaticamente na tela de lançamento.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius)] bg-bg p-1">
            {filtros.map((opcao) => (
              <button
                key={opcao.value}
                type="button"
                onClick={() => setFiltro(opcao.value)}
                className={cn(
                  "min-h-11 shrink-0 cursor-pointer rounded-[calc(var(--radius)-2px)] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  filtro === opcao.value
                    ? "bg-primary text-white"
                    : "text-text-light hover:bg-bg-inset hover:text-text",
                )}
              >
                {opcao.label}
              </button>
            ))}
          </div>
          <label className="flex h-11 w-full items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 lg:w-72">
            <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <span className="sr-only">Buscar atleta ou motivo</span>
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar atleta ou motivo"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-muted sm:text-sm"
            />
          </label>
        </div>
      </Card>

      {items === null ? (
        <div className="flex flex-col gap-3">
          <Card className="h-44 animate-pulse" />
          <Card className="h-44 animate-pulse" />
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarOff}
            title={filtro === "pendente" ? "Nenhuma solicitação pendente" : "Nenhuma justificativa encontrada"}
            description={
              filtro === "pendente"
                ? "Novas solicitações dos atletas aparecerão aqui."
                : "Altere o filtro ou a busca para consultar outros registros."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtrados.map((item) => (
            <Card key={item.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-text">{item.atletaNome}</h3>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {equipeLabel[item.equipe] || item.equipe} · enviada em {formatDateTime(item.criadoEm)}
                  </p>
                </div>
                <Badge tone={tomStatus(item.status)} className="shrink-0">
                  <IconeStatus status={item.status} />
                  {statusJustificativaLabel[item.status]}
                </Badge>
              </div>

              <div className="rounded-[var(--radius)] bg-bg-inset p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-text">{motivoAusenciaLabel[item.motivo]}</strong>
                  <span className="text-xs font-semibold text-primary">{periodoJustificativa(item)}</span>
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-text-light">
                  <Repeat2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {resumoPeriodicidade(item)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-light">
                  {item.descricao}
                </p>
              </div>

              {item.observacaoComite ? (
                <div className="rounded-[var(--radius)] border border-border p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                    Retorno registrado
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-light">
                    {item.observacaoComite}
                  </p>
                </div>
              ) : null}

              {item.status === "encerrada" && item.encerradaAPartirDe ? (
                <p className="rounded-[var(--radius)] bg-bg-inset p-3 text-xs font-medium text-text-light">
                  Encerrada a partir de {formatDataTreino(item.encerradaAPartirDe)}. Os lançamentos anteriores permanecem inalterados.
                </p>
              ) : null}

              {item.status === "pendente" ? (
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => abrirAnalise(item, "recusada")}>
                    <X className="size-4" aria-hidden="true" />
                    Recusar
                  </Button>
                  <Button onClick={() => abrirAnalise(item, "aprovada")}>
                    <Check className="size-4" aria-hidden="true" />
                    Aprovar
                  </Button>
                </div>
              ) : podeEncerrar(item) ? (
                <div className="mt-auto flex items-center justify-between gap-3">
                  {item.analisadoPorNome ? (
                    <p className="text-xs text-text-muted">
                      Analisada por {item.analisadoPorNome} em {formatDateTime(item.analisadoEm)}
                    </p>
                  ) : <span />}
                  <Button variant="secondary" onClick={() => setEncerrando(item)}>
                    <Square className="size-4" aria-hidden="true" />
                    Encerrar
                  </Button>
                </div>
              ) : item.status === "encerrada" && item.encerradoPorNome ? (
                <p className="mt-auto text-xs text-text-muted">
                  Encerrada por {item.encerradoPorNome} em {formatDateTime(item.encerradoEm)}
                </p>
              ) : item.analisadoPorNome ? (
                <p className="mt-auto text-xs text-text-muted">
                  Analisada por {item.analisadoPorNome} em {formatDateTime(item.analisadoEm)}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <AnaliseModal
        key={`${alvo?.id ?? "fechado"}-${decisao}`}
        alvo={alvo}
        decisao={decisao}
        onClose={() => setAlvo(null)}
        onSaved={handleSaved}
      />

      <Modal
        open={encerrando !== null}
        onClose={() => setEncerrando(null)}
        title="Encerrar justificativa"
        description="Ela deixará de valer para os treinos a partir de hoje. Os lançamentos já registrados continuarão inalterados."
        mobileSheet
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setEncerrando(null)}>
            Voltar
          </Button>
          <Button variant="danger" loading={salvandoEncerramento} onClick={handleEncerrar}>
            Encerrar a partir de hoje
          </Button>
        </div>
      </Modal>
    </div>
  );
}
