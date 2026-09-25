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
  Repeat2,
  Send,
  Square,
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
  encerrarJustificativaAusencia,
} from "@/lib/justificativasAusenciaClient";
import {
  dataCivilValida,
  DIAS_SEMANA,
  diasNoIntervalo,
  intervaloAusenciaValido,
  motivoAusenciaLabel,
  MOTIVOS_AUSENCIA,
  periodicidadeAusenciaLabel,
  resumoPeriodicidade,
  statusJustificativaLabel,
} from "@/lib/justificativasAusencia";
import { formatDataTreino, formatDateTime } from "@/lib/format";
import { dataIsoLocal } from "@/lib/date";
import type {
  JustificativaAusenciaDoc,
  MotivoAusencia,
  PeriodicidadeAusencia,
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
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeAusencia>(
    item?.periodicidade ?? "periodo",
  );
  const [inicio, setInicio] = useState(item?.inicio ?? "");
  const [fim, setFim] = useState(item?.fim ?? "");
  const [semDataFinal, setSemDataFinal] = useState(item?.semDataFinal ?? false);
  const [diasSemana, setDiasSemana] = useState<number[]>(item?.diasSemana ?? []);
  const [diaMes, setDiaMes] = useState(item?.diasMes?.[0]?.toString() ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    if (!dataCivilValida(inicio) || (!semDataFinal && !intervaloAusenciaValido(inicio, fim))) {
      setErro("Informe um período válido. A data final não pode ser anterior à inicial.");
      return;
    }
    if (!semDataFinal && periodicidade === "periodo" && diasNoIntervalo(inicio, fim) > 366) {
      setErro("O período deve ter no máximo 366 dias.");
      return;
    }
    if (periodicidade === "semanal" && diasSemana.length === 0) {
      setErro("Selecione pelo menos um dia da semana.");
      return;
    }
    const diaMensal = Number(diaMes);
    if (
      periodicidade === "mensal" &&
      (!Number.isInteger(diaMensal) || diaMensal < 1 || diaMensal > 31)
    ) {
      setErro("Informe um dia do mês entre 1 e 31.");
      return;
    }
    if (descricao.trim().length < 3) {
      setErro("Explique brevemente o motivo da ausência.");
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        motivo,
        inicio,
        fim: semDataFinal ? "" : fim,
        descricao: descricao.trim(),
        periodicidade,
        diasSemana: periodicidade === "semanal" ? diasSemana : [],
        diasMes: periodicidade === "mensal" ? [diaMensal] : [],
        semDataFinal,
      };
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
      description="Informe quando você não poderá treinar. O Comitê analisará antes do lançamento."
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Como a ausência acontece?</label>
          <Select
            value={periodicidade}
            onChange={(event) => setPeriodicidade(event.target.value as PeriodicidadeAusencia)}
          >
            {Object.entries(periodicidadeAusenciaLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        {periodicidade === "semanal" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text">Dias da semana</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {DIAS_SEMANA.map((dia) => {
                const selecionado = diasSemana.includes(dia.value);
                return (
                  <button
                    key={dia.value}
                    type="button"
                    aria-pressed={selecionado}
                    onClick={() => setDiasSemana((atuais) =>
                      selecionado
                        ? atuais.filter((valor) => valor !== dia.value)
                        : [...atuais, dia.value],
                    )}
                    className={`min-h-11 cursor-pointer rounded-[var(--radius)] border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selecionado
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-bg text-text-light hover:bg-bg-inset"
                    }`}
                  >
                    {dia.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {periodicidade === "mensal" ? (
          <div>
            <TextField
              label="Dia do mês"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={diaMes}
              onChange={(event) => setDiaMes(event.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-text-muted">
              Se o mês não tiver esse dia, não haverá ocorrência naquele mês.
            </p>
          </div>
        ) : null}

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
            required={!semDataFinal}
            disabled={semDataFinal}
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-border bg-bg px-3 py-2.5 text-sm text-text-light">
          <input
            type="checkbox"
            checked={semDataFinal}
            onChange={(event) => setSemDataFinal(event.target.checked)}
            className="size-4 accent-primary"
          />
          <span>
            <strong className="block font-semibold text-text">Sem data final</strong>
            A justificativa ficará ativa até você encerrá-la.
          </span>
        </label>

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
  const [encerrando, setEncerrando] = useState<JustificativaAusenciaDoc | null>(null);
  const [salvandoCancelamento, setSalvandoCancelamento] = useState(false);
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);

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
        (item) =>
          item.status === "recusada" ||
          item.status === "cancelada" ||
          item.status === "encerrada",
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

  async function handleEncerrar() {
    if (!encerrando) return;
    setSalvandoEncerramento(true);
    try {
      const atualizado = await encerrarJustificativaAusencia(encerrando.id);
      setItems((atuais) =>
        (atuais ?? []).map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
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
          <span className="text-xs text-text-muted">finalizadas</span>
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
              className={
                item.status === "cancelada" || item.status === "encerrada"
                  ? "opacity-80"
                  : undefined
              }
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
                  <div className="mt-2 flex flex-col gap-1 text-sm font-semibold text-text-light">
                    <span className="flex items-center gap-2">
                      <Repeat2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {resumoPeriodicidade(item)}
                    </span>
                    <span>{periodoJustificativa(item)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-light">
                    {item.descricao}
                  </p>
                  <p className="mt-3 text-xs text-text-muted">
                    Enviada em {formatDateTime(item.criadoEm)}
                  </p>

                  {podeEncerrar(item) ? (
                    <p className="mt-3 rounded-[var(--radius)] bg-success/10 p-3 text-xs font-medium text-success">
                      Esta justificativa será sugerida automaticamente nos lançamentos dentro do período aprovado.
                    </p>
                  ) : item.status === "aprovada" ? (
                    <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-3 text-xs font-medium text-text-light">
                      O período aprovado já foi concluído e permanece disponível no histórico.
                    </p>
                  ) : null}
                  {item.status === "encerrada" && item.encerradaAPartirDe ? (
                    <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-3 text-xs font-medium text-text-light">
                      Encerrada a partir de {formatDataTreino(item.encerradaAPartirDe)}. Os lançamentos anteriores foram preservados.
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
                ) : !isPreview && podeEncerrar(item) ? (
                  <Button variant="secondary" onClick={() => setEncerrando(item)}>
                    <Square className="size-4" aria-hidden="true" />
                    Encerrar
                  </Button>
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

      <Modal
        open={encerrando !== null}
        onClose={() => setEncerrando(null)}
        title="Encerrar justificativa"
        description="Ela deixará de valer para os treinos a partir de hoje. Os lançamentos já registrados continuarão inalterados."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setEncerrando(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={salvandoEncerramento}
            onClick={handleEncerrar}
          >
            Encerrar a partir de hoje
          </Button>
        </div>
      </Modal>
    </div>
  );
}
