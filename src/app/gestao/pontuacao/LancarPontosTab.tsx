"use client";

import { dataIsoLocal } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { Activity, AlertCircle, CalendarCheck, PlusCircle, Target } from "lucide-react";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShortDate } from "@/lib/format";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import {
  justificativaAbrangeData,
  motivoAusenciaLabel,
  resumoJustificativa,
} from "@/lib/justificativasAusencia";
import { ImportarPontuacoesCard } from "./ImportarPontuacoesCard";
import type {
  AtletaDoc,
  EventoDoc,
  JustificativaAusenciaDoc,
  Modalidade,
  RegraPontuacaoDoc,
  TipoLancamento,
} from "@/lib/types";

const tipoOptions: { value: TipoLancamento; label: string; icon: typeof Activity }[] = [
  { value: "treino", label: "Treino", icon: Activity },
  { value: "evento", label: "Evento", icon: CalendarCheck },
  { value: "avulso", label: "Avulso", icon: PlusCircle },
];

export function LancarPontosTab({
  justificativas,
  erroJustificativas,
}: {
  justificativas: JustificativaAusenciaDoc[];
  erroJustificativas: boolean;
}) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();

  const [modalidade, setModalidade] = useState<Modalidade>("corrida");
  const [tipo, setTipo] = useState<TipoLancamento>("treino");
  const [dataTreino, setDataTreino] = useState(() => dataIsoLocal());
  const [descricaoLote, setDescricaoLote] = useState("");
  const [kmLote, setKmLote] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [eventosJaLancados, setEventosJaLancados] = useState<Set<string>>(new Set());
  const [marcados, setMarcados] = useState<Record<string, Set<string>>>({});
  const [faltosos, setFaltosos] = useState<Set<string>>(new Set());
  const [faltasAutomaticasIgnoradas, setFaltasAutomaticasIgnoradas] = useState<Set<string>>(
    new Set(),
  );
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [kmPorAtleta, setKmPorAtleta] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("equipe", "==", modalidade)),
      (snap) => {
        setAtletas(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
            .filter((a) => a.ativo && perfilAtletaVisivel(a))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        );
      },
      () => setAtletas([]),
    );
    return unsubscribe;
  }, [modalidade]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regras_pontuacao"), (snap) => {
      setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), orderBy("data", "desc")),
      (snap) => setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
      () => setEventos([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, "historico_pontos"), where("eventoId", "!=", ""))).then((snap) => {
      const usados = new Set<string>();
      snap.docs.forEach((d) => {
        const eventoId = (d.data() as { eventoId?: string }).eventoId;
        if (eventoId) usados.add(eventoId);
      });
      setEventosJaLancados(usados);
    });
  }, []);

  const eventosDisponiveis = useMemo(() => {
    if (!eventos) return { proximos: [], recentes: [] };
    const hoje = dataIsoLocal();
    const limite = new Date();
    limite.setDate(limite.getDate() - 7);
    const limiteStr = dataIsoLocal(limite);

    const disponiveis = eventos.filter((e) => e.id === eventoId || !eventosJaLancados.has(e.id));
    const proximos = disponiveis
      .filter((e) => e.data >= hoje)
      .sort((a, b) => a.data.localeCompare(b.data));
    const recentes = disponiveis
      .filter((e) => e.data < hoje && e.data >= limiteStr)
      .sort((a, b) => b.data.localeCompare(a.data));
    return { proximos, recentes };
  }, [eventos, eventosJaLancados, eventoId]);

  const regrasCompativeis = useMemo(() => {
    if (!regras) return [];
    return regras.filter(
      (r) => (r.modalidade === "ambas" || r.modalidade === modalidade) &&
        r.tiposLancamento.includes(tipo),
    );
  }, [regras, modalidade, tipo]);

  const justificativaPorAtleta = useMemo(() => {
    const mapa = new Map<string, JustificativaAusenciaDoc>();
    if (!dataTreino || tipo === "avulso") return mapa;
    for (const justificativa of justificativas) {
      if (
        !mapa.has(justificativa.atletaId) &&
        justificativaAbrangeData(justificativa, dataTreino)
      ) {
        mapa.set(justificativa.atletaId, justificativa);
      }
    }
    return mapa;
  }, [dataTreino, justificativas, tipo]);

  const faltososEfetivos = useMemo(() => {
    const ids = new Set(faltosos);
    for (const atletaId of justificativaPorAtleta.keys()) {
      if (!faltasAutomaticasIgnoradas.has(atletaId)) ids.add(atletaId);
    }
    return ids;
  }, [faltasAutomaticasIgnoradas, faltosos, justificativaPorAtleta]);

  function resetSelecao() {
    setMarcados({});
    setFaltosos(new Set());
    setFaltasAutomaticasIgnoradas(new Set());
    setObservacoes({});
    setKmPorAtleta({});
  }

  /**
   * Limpa o formulário inteiro após salvar, incluindo a data — ela não volta pra "hoje"
   * sozinha pra obrigar quem está lançando a escolher de novo e evitar lançar em lote
   * na data errada por distração.
   */
  function resetFormulario() {
    resetSelecao();
    setDescricaoLote("");
    setEventoId("");
    setKmLote("");
    setDataTreino("");
  }

  function handleTipoChange(novoTipo: TipoLancamento) {
    setTipo(novoTipo);
    resetSelecao();
    setEventoId("");
    setDescricaoLote("");
    if (novoTipo === "treino") {
      setKmLote("");
      setDataTreino("");
    }
  }

  function handleEventoChange(id: string) {
    setEventoId(id);
    if (!id) return;
    const evento = eventos?.find((e) => e.id === id);
    if (!evento) return;
    setDescricaoLote(evento.titulo);
    setDataTreino(evento.data);
    setFaltasAutomaticasIgnoradas(new Set());
    if (evento.km) setKmLote(String(evento.km));
    if (evento.modalidade !== "ambas" && evento.modalidade !== modalidade) {
      setModalidade(evento.modalidade);
      resetSelecao();
    }
  }

  const descricaoPlaceholder =
    tipo === "evento"
      ? "A descrição será preenchida com o evento selecionado"
      : tipo === "avulso"
        ? "Ex: Ajuste aprovado pelo comitê / Participação externa"
        : "Ex: Treino de sábado / Treino especial";

  function toggleRegra(atletaId: string, regraId: string) {
    setMarcados((prev) => {
      const atual = new Set(prev[atletaId] ?? []);
      if (atual.has(regraId)) {
        atual.delete(regraId);
      } else {
        const regra = regrasCompativeis.find((r) => r.id === regraId);
        const excludentes = new Set(regra?.regrasExcludentes ?? []);
        for (const marcadaId of [...atual]) {
          const marcada = regrasCompativeis.find((r) => r.id === marcadaId);
          const marcadaExcludeEsta = marcada?.regrasExcludentes?.includes(regraId);
          if (excludentes.has(marcadaId) || marcadaExcludeEsta) {
            atual.delete(marcadaId);
          }
        }
        atual.add(regraId);
      }
      return { ...prev, [atletaId]: atual };
    });
  }

  function toggleFalta(atletaId: string) {
    if (justificativaPorAtleta.has(atletaId)) {
      const estaMarcado = faltososEfetivos.has(atletaId);
      setFaltasAutomaticasIgnoradas((prev) => {
        const next = new Set(prev);
        if (estaMarcado) next.add(atletaId);
        else next.delete(atletaId);
        return next;
      });
      setFaltosos((prev) => {
        const next = new Set(prev);
        next.delete(atletaId);
        return next;
      });
      return;
    }
    setFaltosos((prev) => {
      const next = new Set(prev);
      if (next.has(atletaId)) next.delete(atletaId);
      else next.add(atletaId);
      return next;
    });
  }

  function toggleFaltaTodos() {
    if (!atletas) return;
    const todosMarcados = atletas.every((a) => faltososEfetivos.has(a.id));
    if (todosMarcados) {
      setFaltosos(new Set());
      setFaltasAutomaticasIgnoradas(new Set(justificativaPorAtleta.keys()));
    } else {
      setFaltosos(new Set(atletas.map((a) => a.id)));
      setFaltasAutomaticasIgnoradas(new Set());
    }
  }

  function pontosDoAtleta(atletaId: string) {
    const marcadas = marcados[atletaId];
    if (!marcadas || marcadas.size === 0) return 0;
    return regrasCompativeis
      .filter((r) => marcadas.has(r.id))
      .reduce((sum, r) => sum + r.pontos, 0);
  }

  const totalAtletasEnvolvidos = atletas?.filter(
    (a) => faltososEfetivos.has(a.id) || pontosDoAtleta(a.id) > 0,
  ).length ?? 0;

  async function handleSalvar() {
    if (!atletas) return;
    if (!dataTreino) {
      show("info", "Selecione a data do lançamento antes de salvar.");
      return;
    }
    if (dataTreino > dataIsoLocal()) {
      show("error", "A data não pode ser no futuro.");
      return;
    }
    if (!descricaoLote.trim()) {
      show("info", "Descreva o treino ou atividade antes de salvar.");
      return;
    }
    if (totalAtletasEnvolvidos === 0) {
      show("info", "Marque ao menos um atleta (pontuação ou falta) antes de salvar.");
      return;
    }

    setSalvando(true);
    try {
      const loteId = doc(collection(db, "historico_pontos")).id;
      const batch = writeBatch(db);
      const kmLoteNum = Number(kmLote.replace(",", ".")) || 0;
      const dadosLote = {
        dataTreino,
        loteId,
        descricaoLote: descricaoLote.trim(),
        ...(eventoId ? { eventoId } : {}),
        tipoLancamento: tipo,
        criadoPor: uid,
        criadoPorNome: autor.nome,
        criadoEm: serverTimestamp(),
        estornado: false,
      };

      for (const atletaDoc of atletas) {
        const isFalta = faltososEfetivos.has(atletaDoc.id);
        const marcadas = marcados[atletaDoc.id];
        const temPontos = !isFalta && marcadas && marcadas.size > 0;
        if (!isFalta && !temPontos) continue;

        let totalAtleta = 0;
        const kmOverride = kmPorAtleta[atletaDoc.id]?.trim();
        const kmPercorrido = kmOverride ? Number(kmOverride.replace(",", ".")) || 0 : kmLoteNum;
        const justificativa = justificativaPorAtleta.get(atletaDoc.id);
        const justificativaAplicada =
          isFalta && justificativa && !faltasAutomaticasIgnoradas.has(atletaDoc.id)
            ? justificativa
            : null;
        const observacaoAutomatica = justificativaAplicada
          ? resumoJustificativa(justificativaAplicada)
          : "";
        const observacao = (observacoes[atletaDoc.id] ?? observacaoAutomatica).trim();

        if (isFalta) {
          const lancamentoRef = doc(collection(db, "historico_pontos"));
          batch.set(lancamentoRef, {
            id: lancamentoRef.id,
            atletaId: atletaDoc.id,
            atletaNome: atletaDoc.nome,
            equipe: atletaDoc.equipe,
            regraId: "falta_justificada",
            regraDesc: "Falta justificada",
            pontos: 0,
            kmPercorrido: 0,
            ...(observacao ? { observacao } : {}),
            ...(justificativaAplicada
              ? {
                  justificativaAusenciaId: justificativaAplicada.id,
                  justificativaMotivo: justificativaAplicada.motivo,
                  justificativaDescricao: justificativaAplicada.descricao,
                  justificativaInicio: justificativaAplicada.inicio,
                  justificativaFim: justificativaAplicada.fim,
                }
              : {}),
            ...dadosLote,
          });
        } else {
          for (const regraId of marcadas!) {
            const regra = regrasCompativeis.find((r) => r.id === regraId);
            if (!regra) continue;
            totalAtleta += regra.pontos;
            const lancamentoRef = doc(collection(db, "historico_pontos"));
            batch.set(lancamentoRef, {
              id: lancamentoRef.id,
              atletaId: atletaDoc.id,
              atletaNome: atletaDoc.nome,
              equipe: atletaDoc.equipe,
              regraId: regra.id,
              regraDesc: regra.descricao,
              pontos: regra.pontos,
              ...(kmPercorrido > 0 ? { kmPercorrido } : {}),
              ...(observacao ? { observacao } : {}),
              ...dadosLote,
            });
          }
        }

        if (totalAtleta > 0) {
          batch.update(doc(db, "atletas", atletaDoc.id), {
            pontuacaoTotal: increment(totalAtleta),
            atualizadoEm: serverTimestamp(),
          });
          batch.set(
            atletaPublicoRef(atletaDoc.id),
            { pontuacaoTotal: increment(totalAtleta) },
            { merge: true },
          );
        }
      }

      const dataFormatada = formatShortDate(dataTreino);
      for (const [atletaId, texto] of Object.entries(observacoes)) {
        if (!texto.trim()) continue;
        const envolvido = faltososEfetivos.has(atletaId) || (marcados[atletaId]?.size ?? 0) > 0;
        if (!envolvido) continue;
        const comentarioRef = doc(collection(db, "comentarios_atletas"));
        batch.set(comentarioRef, {
          atletaId,
          texto: `[Ref: ${dataFormatada} — ${descricaoLote.trim()}] ${texto.trim()}`,
          autorNome: autor.nome,
          autorUid: uid,
          criadoEm: serverTimestamp(),
        });
      }

      await batch.commit();

      const atletaIds = atletas
        .filter((item) => faltososEfetivos.has(item.id) || (marcados[item.id]?.size ?? 0) > 0)
        .map((item) => item.id);
      const rankingAtualizado = await atualizarRankingAutomaticamente(
        atletaIds,
        "lancamento_manual",
      );
      show(
        rankingAtualizado ? "success" : "info",
        rankingAtualizado
          ? `Lançamento registrado para ${totalAtletasEnvolvidos} atleta(s). Ranking atualizado.`
          : `Lançamento registrado para ${totalAtletasEnvolvidos} atleta(s), mas o ranking automático não atualizou. Use "Recalcular agora".`,
      );
      resetFormulario();
    } catch {
      show("error", "Não foi possível salvar o lançamento agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ImportarPontuacoesCard />

      {erroJustificativas ? (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-warning/25 bg-warning/10 p-3 text-sm text-text-light">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-ranking-gold-text" aria-hidden="true" />
          <p>
            As justificativas aprovadas não puderam ser carregadas. O lançamento manual continua disponível, mas confira a aba Justificativas antes de salvar.
          </p>
        </div>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-light">Tipo de lançamento</label>
          <SegmentedControl value={tipo} onChange={handleTipoChange} options={tipoOptions} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tipo === "evento" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-light">Vincular a evento</label>
              <Select value={eventoId} onChange={(e) => handleEventoChange(e.target.value)}>
                <option value="">Selecione um evento</option>
                {eventosDisponiveis.proximos.length > 0 && (
                  <optgroup label="Eventos de hoje e próximos">
                    {eventosDisponiveis.proximos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.titulo} ({formatShortDate(e.data)})
                      </option>
                    ))}
                  </optgroup>
                )}
                {eventosDisponiveis.recentes.length > 0 && (
                  <optgroup label="Eventos realizados nos últimos 7 dias">
                    {eventosDisponiveis.recentes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.titulo} ({formatShortDate(e.data)})
                      </option>
                    ))}
                  </optgroup>
                )}
                {eventosDisponiveis.proximos.length === 0 && eventosDisponiveis.recentes.length === 0 && (
                  <option value="" disabled>
                    Nenhum evento disponível para lançamento
                  </option>
                )}
              </Select>
              <p className="text-xs text-text-muted">
                Eventos já lançados são ocultados para evitar duplicidade.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Descrição do treino / atividade</label>
            <input
              value={descricaoLote}
              onChange={(e) => setDescricaoLote(e.target.value)}
              placeholder={descricaoPlaceholder}
              className="h-10 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Equipe alvo</label>
            <Select
              className="w-44"
              value={modalidade}
              onChange={(e) => {
                setModalidade(e.target.value as Modalidade);
                resetSelecao();
              }}
            >
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bicicleta</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Data</label>
            <input
              type="date"
              value={dataTreino}
              max={dataIsoLocal()}
              onChange={(e) => {
                setDataTreino(e.target.value);
                setFaltasAutomaticasIgnoradas(new Set());
              }}
              className="h-10 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">KM padrão (todos marcados)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={kmLote}
              onChange={(e) => setKmLote(e.target.value)}
              placeholder="Opcional"
              className="h-10 w-36 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <p className="text-xs text-text-muted">
              Usado pra quem não tiver um KM individual na tabela abaixo.
            </p>
          </div>
        </div>
      </Card>

      {atletas === null || regras === null ? (
        <Card className="h-64 animate-pulse" />
      ) : regrasCompativeis.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhuma regra compatível"
            description="Cadastre uma regra de pontuação para esta modalidade e tipo de lançamento."
          />
        </Card>
      ) : atletas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhum atleta nesta modalidade"
            description="Cadastre atletas em Gestão de atletas para lançar pontos aqui."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="sticky left-0 z-[1] bg-bg-card px-4 py-3 font-semibold">Atleta</th>
                {regrasCompativeis.map((r) => (
                  <th key={r.id} className="px-3 py-3 text-center font-semibold">
                    {r.descricao}
                    <span className="block font-normal normal-case text-text-muted">
                      {r.pontos} pts
                    </span>
                  </th>
                ))}
                <th className="w-[110px] border-l border-border px-3 py-3 text-center font-semibold">
                  KM
                  <span className="block font-normal normal-case text-text-muted">individual</span>
                </th>
                <th className="border-l border-border px-3 py-3 text-center font-semibold text-accent">
                  Falta justificada
                  <label className="mt-1 flex items-center justify-center gap-1.5 font-normal normal-case text-text-muted">
                    <input
                      type="checkbox"
                      aria-label="Marcar falta justificada para todo o time"
                      checked={atletas.length > 0 && atletas.every((a) => faltososEfetivos.has(a.id))}
                      onChange={toggleFaltaTodos}
                      className="size-3.5 rounded border-border accent-accent"
                    />
                    Todo time
                  </label>
                </th>
                <th className="w-[180px] border-l border-border px-3 py-3 text-left font-semibold">
                  Observação
                </th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {atletas.map((a) => {
                const isFalta = faltososEfetivos.has(a.id);
                const justificativa = justificativaPorAtleta.get(a.id);
                const justificativaAplicada =
                  justificativa && !faltasAutomaticasIgnoradas.has(a.id)
                    ? justificativa
                    : null;
                const observacaoAutomatica = justificativaAplicada
                  ? resumoJustificativa(justificativaAplicada)
                  : "";
                const temMarcacao = isFalta || (marcados[a.id]?.size ?? 0) > 0;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-[1] bg-bg-card px-4 py-3 font-medium text-text">
                      {a.nome}
                    </td>
                    {regrasCompativeis.map((r) => (
                      <td key={r.id} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Marcar ${r.descricao} para ${a.nome}`}
                          disabled={isFalta}
                          checked={marcados[a.id]?.has(r.id) ?? false}
                          onChange={() => toggleRegra(a.id, r.id)}
                          className="size-4 rounded border-border accent-primary disabled:opacity-30"
                        />
                      </td>
                    ))}
                    <td className="border-l border-border px-2 py-3 text-center">
                      {temMarcacao && !isFalta ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={kmPorAtleta[a.id] ?? ""}
                          onChange={(e) =>
                            setKmPorAtleta((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          placeholder={kmLote || "—"}
                          className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-center text-xs text-text outline-none placeholder:text-text-muted focus:border-primary"
                        />
                      ) : (
                        <div className="h-8" />
                      )}
                    </td>
                    <td className="border-l border-border px-3 py-3 text-center">
                      <div className="flex min-w-32 flex-col items-center gap-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Marcar falta justificada para ${a.nome}`}
                          checked={isFalta}
                          onChange={() => toggleFalta(a.id)}
                          className="size-4 rounded border-border accent-accent"
                        />
                        {justificativa ? (
                          <span
                            className={
                              justificativaAplicada
                                ? "text-[10px] font-semibold text-success"
                                : "text-[10px] font-semibold text-text-muted"
                            }
                          >
                            {justificativaAplicada
                              ? `${motivoAusenciaLabel[justificativa.motivo]} · aprovada`
                              : "Aprovada · não aplicada"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="w-[180px] border-l border-border px-3 py-3">
                      {temMarcacao ? (
                        <input
                          value={observacoes[a.id] ?? observacaoAutomatica}
                          onChange={(e) =>
                            setObservacoes((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          placeholder="Lesão, atestado…"
                          className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-xs text-text outline-none placeholder:text-text-muted focus:border-primary"
                        />
                      ) : (
                        <div className="h-8" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-text">
                      {isFalta ? "—" : pontosDoAtleta(a.id)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-light">
          {totalAtletasEnvolvidos} atleta(s) receberão este lançamento (pontos ou falta justificada).
        </p>
        <Button onClick={handleSalvar} loading={salvando} disabled={!atletas || !regras}>
          Salvar lançamento
        </Button>
      </div>
    </div>
  );
}
