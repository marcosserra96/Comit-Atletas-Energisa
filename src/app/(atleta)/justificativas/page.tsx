"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  atualizarJustificativaAusencia,
  cancelarJustificativaAusencia,
  carregarMinhasJustificativas,
  criarJustificativaAusencia,
} from "@/lib/justificativasAusenciaClient";
import {
  diasNoIntervalo,
  intervaloAusenciaValido,
  motivoAusenciaLabel,
  MOTIVOS_AUSENCIA,
  statusJustificativaLabel,
} from "@/lib/justificativasAusencia";
import { formatDataTreino, formatDateTime } from "@/lib/format";
import type {
  JustificativaAusenciaDoc,
  MotivoAusencia,
  StatusJustificativaAusencia,
} from "@/lib/types";

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

function SolicitacaoModal({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: JustificativaAusenciaDoc | null;
  onClose: () => void;
  onSaved: (item: JustificativaAusenciaDoc) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoAusencia>(item?.motivo ?? "viagem");
  const [inicio, setInicio] = useState(item?.inicio ?? "");
  const [fim, setFim] = useState(item?.fim ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    if (!intervaloAusenciaValido(inicio, fim)) {
      setErro("Informe um período válido. A data final não pode ser anterior à inicial.");
      return;
    }
    if (diasNoIntervalo(inicio, fim) > 366) {
      setErro("O período deve ter no máximo 366 dias.");
      return;
    }
    if (descricao.trim().length < 3) {
      setErro("Explique brevemente o motivo da ausência.");
      return;
    }

    setSalvando(true);
    try {
      const dados = { motivo, inicio, fim, descricao: descricao.trim() };
      const salvo = item
        ? await atualizarJustificativaAusencia(item.id, dados)
        : await criarJustificativaAusencia(dados);
      onSaved(salvo);
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Não foi possível enviar a justificativa.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Editar justificativa" : "Informar ausência"}
      description="Informe o período em que você não poderá treinar. O Comitê analisará antes do lançamento."
      size="md"
      mobileSheet
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {erro ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius)] border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{erro}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Motivo</label>
          <Select value={motivo} onChange={(event) => setMotivo(event.target.value as MotivoAusencia)}>
            {MOTIVOS_AUSENCIA.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Data inicial"
            type="date"
            value={inicio}
            onChange={(event) => {
              setInicio(event.target.value);
              if (!fim || fim < event.target.value) setFim(event.target.value);
            }}
            required
          />
          <TextField
            label="Data final"
            type="date"
            min={inicio || undefined}
            value={fim}
            onChange={(event) => setFim(event.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="descricao-ausencia" className="text-sm font-medium text-text">
              Descrição
            </label>
            <span className="text-xs text-text-muted">{descricao.length}/1000</span>
          </div>
          <textarea
            id="descricao-ausencia"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value.slice(0, 1000))}
            rows={4}
            maxLength={1000}
            required
            placeholder="Explique brevemente por que ficará sem treinar."
            className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3.5 py-3 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
          />
          <p className="text-xs text-text-muted">
            Evite incluir diagnósticos ou informações médicas além do necessário.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" loading={salvando}>
            <Send className="size-4" aria-hidden="true" />
            {item ? "Salvar alterações" : "Enviar ao Comitê"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function JustificativasPage() {
  const { atleta, isPreview } = useAthleteView();
  const { show } = useToast();
  const [items, setItems] = useState<JustificativaAusenciaDoc[] | null>(null);
  const [erro, setErro] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<JustificativaAusenciaDoc | null>(null);
  const [cancelando, setCancelando] = useState<JustificativaAusenciaDoc | null>(null);
  const [salvandoCancelamento, setSalvandoCancelamento] = useState(false);

  async function carregar() {
    setErro(false);
    try {
      setItems(await carregarMinhasJustificativas(isPreview ? atleta.id : undefined));
    } catch {
      setItems([]);
      setErro(true);
    }
  }

  useEffect(() => {
    let ativo = true;
    void carregarMinhasJustificativas(isPreview ? atleta.id : undefined)
      .then((lista) => {
        if (!ativo) return;
        setItems(lista);
        setErro(false);
      })
      .catch(() => {
        if (!ativo) return;
        setItems([]);
        setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, [atleta.id, isPreview]);

  const totais = useMemo(() => {
    const lista = items ?? [];
    return {
      pendentes: lista.filter((item) => item.status === "pendente").length,
      aprovadas: lista.filter((item) => item.status === "aprovada").length,
      encerradas: lista.filter(
        (item) => item.status === "recusada" || item.status === "cancelada",
      ).length,
    };
  }, [items]);

  function handleSaved(item: JustificativaAusenciaDoc) {
    setItems((atuais) => {
      const lista = atuais ?? [];
      const existe = lista.some((atual) => atual.id === item.id);
      return existe
        ? lista.map((atual) => (atual.id === item.id ? item : atual))
        : [item, ...lista];
    });
    setModalAberto(false);
    setEditando(null);
    show("success", editando ? "Justificativa atualizada." : "Justificativa enviada ao Comitê.");
  }

  async function handleCancelar() {
    if (!cancelando) return;
    setSalvandoCancelamento(true);
    try {
      const atualizado = await cancelarJustificativaAusencia(cancelando.id);
      setItems((atuais) =>
        (atuais ?? []).map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      setCancelando(null);
      show("success", "Justificativa cancelada.");
    } catch (error) {
      show(
        "error",
        error instanceof Error ? error.message : "Não foi possível cancelar agora.",
      );
    } finally {
      setSalvandoCancelamento(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        icon={CalendarOff}
        title="Minhas justificativas"
        description={
          isPreview
            ? `Consulta das solicitações de ${atleta.nome}.`
            : "Avise o Comitê quando precisar se afastar dos treinos."
        }
        actions={
          !isPreview ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Informar ausência
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card padding="sm" className="text-center">
          <strong className="block text-xl font-extrabold text-ranking-gold-text">
            {items === null ? "—" : totais.pendentes}
          </strong>
          <span className="text-xs text-text-muted">pendentes</span>
        </Card>
        <Card padding="sm" className="text-center">
          <strong className="block text-xl font-extrabold text-success">
            {items === null ? "—" : totais.aprovadas}
          </strong>
          <span className="text-xs text-text-muted">aprovadas</span>
        </Card>
        <Card padding="sm" className="text-center">
          <strong className="block text-xl font-extrabold text-text-muted">
            {items === null ? "—" : totais.encerradas}
          </strong>
          <span className="text-xs text-text-muted">encerradas</span>
        </Card>
      </div>

      {erro ? (
        <Card className="flex flex-col items-center gap-3 py-9 text-center">
          <AlertCircle className="size-8 text-danger" aria-hidden="true" />
          <div>
            <p className="font-bold text-text">Não foi possível carregar as justificativas</p>
            <p className="mt-1 text-sm text-text-light">Confira sua conexão e tente novamente.</p>
          </div>
          <Button variant="secondary" onClick={() => void carregar()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </Card>
      ) : items === null ? (
        <div className="flex flex-col gap-3">
          <Card className="h-36 animate-pulse" />
          <Card className="h-36 animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarOff}
            title="Nenhuma justificativa enviada"
            description="Quando precisar se afastar, informe o período para o Comitê analisar."
            action={
              !isPreview ? (
                <Button
                  onClick={() => {
                    setEditando(null);
                    setModalAberto(true);
                  }}
                >
                  Informar ausência
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={item.status === "cancelada" ? "opacity-70" : undefined}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-text">{motivoAusenciaLabel[item.motivo]}</h2>
                    <Badge tone={tomStatus(item.status)}>
                      <IconeStatus status={item.status} />
                      {statusJustificativaLabel[item.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-text-light">
                    {formatDataTreino(item.inicio)}
                    {item.fim !== item.inicio ? ` a ${formatDataTreino(item.fim)}` : ""}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-light">
                    {item.descricao}
                  </p>
                  <p className="mt-3 text-xs text-text-muted">
                    Enviada em {formatDateTime(item.criadoEm)}
                  </p>

                  {item.status === "aprovada" ? (
                    <p className="mt-3 rounded-[var(--radius)] bg-success/10 p-3 text-xs font-medium text-success">
                      Esta justificativa será sugerida automaticamente nos lançamentos dentro do período aprovado.
                    </p>
                  ) : null}
                  {item.observacaoComite ? (
                    <div className="mt-3 rounded-[var(--radius)] bg-bg-inset p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                        Retorno do Comitê
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-light">
                        {item.observacaoComite}
                      </p>
                    </div>
                  ) : null}
                </div>

                {!isPreview && item.status === "pendente" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditando(item);
                        setModalAberto(true);
                      }}
                    >
                      <Edit3 className="size-4" aria-hidden="true" />
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelando(item)}>
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <SolicitacaoModal
        key={`${editando?.id ?? "nova"}-${modalAberto ? "aberta" : "fechada"}`}
        open={modalAberto}
        item={editando}
        onClose={() => {
          setModalAberto(false);
          setEditando(null);
        }}
        onSaved={handleSaved}
      />

      <Modal
        open={cancelando !== null}
        onClose={() => setCancelando(null)}
        title="Cancelar justificativa"
        description="A solicitação sairá da fila do Comitê. Essa ação não poderá ser desfeita."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCancelando(null)}>
            Voltar
          </Button>
          <Button variant="danger" loading={salvandoCancelamento} onClick={handleCancelar}>
            Cancelar solicitação
          </Button>
        </div>
      </Modal>
    </div>
  );
}
