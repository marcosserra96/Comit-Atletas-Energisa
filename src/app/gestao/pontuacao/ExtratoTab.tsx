"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { CalendarDays, ChevronDown, History, RotateCcw, Search, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmarPerigoModal } from "@/components/ui/ConfirmarPerigoModal";
import { logAudit } from "@/lib/audit";
import { formatDataTreino, formatDateTime, formatPontos, plural } from "@/lib/format";
import { dataIsoLocal } from "@/lib/date";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { EstornarModal } from "./EstornarModal";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

/** Quantos lançamentos cada "Carregar mais" traz. */
const POR_PAGINA = 100;
/** Limite do Firestore para `in`; acima disso o filtro de atleta vira local. */
const MAX_IN = 30;
const TAMANHO_LOTE = 400;

/** Minúsculas e sem acento, para "joao" achar "João". */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Início e fim (exclusivo) do dia no fuso local. */
function intervaloDoDia(dia: string) {
  const [ano, mes, d] = dia.split("-").map(Number);
  return { inicio: new Date(ano, mes - 1, d), fim: new Date(ano, mes - 1, d + 1) };
}

export function ExtratoTab() {
  const { uid, atleta, usuario } = useActiveSession();
  const { show } = useToast();
  const isAdmin = usuario.role === "administrador";
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [buscaAtleta, setBuscaAtleta] = useState("");
  const [termoAtleta, setTermoAtleta] = useState("");
  const [dataRegistro, setDataRegistro] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [quantidade, setQuantidade] = useState(POR_PAGINA);
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [alvo, setAlvo] = useState<HistoricoPontoDoc | null>(null);
  const [alvoExclusao, setAlvoExclusao] = useState<HistoricoPontoDoc[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ultimoIndice, setUltimoIndice] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "atletas"), (snap) => {
      setAtletas(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
    });
    return unsubscribe;
  }, []);

  // Espera a pessoa parar de digitar antes de refazer a consulta.
  useEffect(() => {
    const t = setTimeout(() => setTermoAtleta(normalizar(buscaAtleta)), 250);
    return () => clearTimeout(t);
  }, [buscaAtleta]);

  const atletasVisiveis = useMemo(() => (atletas ?? []).filter(perfilAtletaVisivel), [atletas]);

  /** Atletas cujo nome contém o texto digitado; null = sem filtro de atleta. */
  const atletasDoFiltro = useMemo(
    () => (termoAtleta ? atletasVisiveis.filter((a) => normalizar(a.nome).includes(termoAtleta)) : null),
    [atletasVisiveis, termoAtleta],
  );
  const idsNaConsulta =
    atletasDoFiltro && atletasDoFiltro.length > 0 && atletasDoFiltro.length <= MAX_IN
      ? atletasDoFiltro.map((a) => a.id)
      : null;
  const chaveIds = idsNaConsulta?.join(",") ?? "";

  /** Quem pode ter registrado: comitê e administradores, mais nomes já vistos nos lançamentos. */
  const pessoas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const a of atletas ?? []) {
      if ((a.role === "comite" || a.role === "administrador") && a.authUid) mapa.set(a.authUid, a.nome);
    }
    for (const l of lancamentos ?? []) {
      if (l.criadoPor && !mapa.has(l.criadoPor)) mapa.set(l.criadoPor, l.criadoPorNome || "Sem nome");
    }
    return [...mapa.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [atletas, lancamentos]);

  const semAtletaEncontrado = atletasDoFiltro !== null && atletasDoFiltro.length === 0;

  useEffect(() => {
    if (atletas === null || semAtletaEncontrado) return;
    const atletaIdsVisiveis = new Set(atletasVisiveis.map((item) => item.id));
    const restricoes = [];
    const ids = chaveIds ? chaveIds.split(",") : [];
    if (ids.length === 1) restricoes.push(where("atletaId", "==", ids[0]));
    else if (ids.length > 1) restricoes.push(where("atletaId", "in", ids));
    if (dataRegistro) {
      const { inicio, fim } = intervaloDoDia(dataRegistro);
      restricoes.push(where("criadoEm", ">=", Timestamp.fromDate(inicio)));
      restricoes.push(where("criadoEm", "<", Timestamp.fromDate(fim)));
    }
    const q = query(
      collection(db, "historico_pontos"),
      ...restricoes,
      orderBy("criadoEm", "desc"),
      limit(quantidade),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setTemMais(snap.size >= quantidade);
        setLancamentos(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc)
            .filter((item) => atletaIdsVisiveis.has(item.atletaId)),
        );
      },
      () => {
        setTemMais(false);
        setLancamentos([]);
      },
    );
    return unsubscribe;
  }, [atletas, atletasVisiveis, chaveIds, dataRegistro, quantidade, semAtletaEncontrado]);

  /** O que aparece na tabela: filtros que o banco não faz (pessoa e, com muitos atletas, o nome). */
  const visiveis = useMemo(() => {
    if (semAtletaEncontrado) return [];
    let lista = lancamentos ?? [];
    if (atletasDoFiltro && !idsNaConsulta) {
      const ids = new Set(atletasDoFiltro.map((a) => a.id));
      lista = lista.filter((l) => ids.has(l.atletaId));
    }
    if (pessoa) lista = lista.filter((l) => l.criadoPor === pessoa);
    return lista;
  }, [lancamentos, atletasDoFiltro, idsNaConsulta, pessoa, semAtletaEncontrado]);

  const carregando = lancamentos === null && !semAtletaEncontrado;
  const filtroAtivo = Boolean(buscaAtleta.trim() || dataRegistro || pessoa);

  /** Mudar qualquer filtro volta para a primeira página e limpa a seleção. */
  function aoMudarFiltro() {
    setQuantidade(POR_PAGINA);
    setSelecionados(new Set());
    setUltimoIndice(null);
  }

  function limparFiltros() {
    setBuscaAtleta("");
    setDataRegistro("");
    setPessoa("");
    aoMudarFiltro();
  }

  function toggleSelecionado(id: string, indice: number, shiftKey: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (shiftKey && ultimoIndice !== null) {
        const inicio = Math.min(ultimoIndice, indice);
        const fim = Math.max(ultimoIndice, indice);
        const marcar = !prev.has(id);
        for (let i = inicio; i <= fim; i++) {
          if (!visiveis[i]) continue;
          if (marcar) next.add(visiveis[i].id);
          else next.delete(visiveis[i].id);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setUltimoIndice(indice);
  }

  function toggleSelecionarTodos() {
    if (visiveis.length === 0) return;
    const todosMarcados = visiveis.every((l) => selecionados.has(l.id));
    setSelecionados(todosMarcados ? new Set() : new Set(visiveis.map((l) => l.id)));
    setUltimoIndice(null);
  }

  async function handleEstornar(motivo: string) {
    if (!alvo) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "historico_pontos", alvo.id), {
        estornado: true,
        estornadoEm: serverTimestamp(),
        estornadoPor: uid,
        motivoEstorno: motivo,
      });
      batch.update(doc(db, "atletas", alvo.atletaId), {
        pontuacaoTotal: increment(-alvo.pontos),
        atualizadoEm: serverTimestamp(),
      });
      batch.set(
        atletaPublicoRef(alvo.atletaId),
        { pontuacaoTotal: increment(-alvo.pontos) },
        { merge: true },
      );
      await batch.commit();
      await logAudit({
        acao: "estornar_lancamento",
        entidade: "historico_pontos",
        entidadeId: alvo.id,
        dados: { motivo, pontos: alvo.pontos, atletaId: alvo.atletaId },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      const rankingAtualizado = await atualizarRankingAutomaticamente(
        [alvo.atletaId],
        "estorno_lancamento",
      );
      show(
        rankingAtualizado ? "success" : "info",
        rankingAtualizado
          ? "Lançamento estornado. Ranking atualizado."
          : "Lançamento estornado, mas o ranking automático não atualizou. Use \"Recalcular agora\".",
      );
      setAlvo(null);
    } catch {
      show("error", "Não foi possível estornar agora. Tente novamente.");
    }
  }

  async function handleExcluir() {
    if (!alvoExclusao || alvoExclusao.length === 0) return;
    try {
      // Se o lançamento ainda estava valendo (não estornado), os pontos precisam sair do total do atleta.
      const decrementoPorAtleta = new Map<string, number>();
      for (const l of alvoExclusao) {
        if (!l.estornado) {
          decrementoPorAtleta.set(l.atletaId, (decrementoPorAtleta.get(l.atletaId) ?? 0) + l.pontos);
        }
      }

      for (let i = 0; i < alvoExclusao.length; i += TAMANHO_LOTE) {
        const grupo = alvoExclusao.slice(i, i + TAMANHO_LOTE);
        const batch = writeBatch(db);
        grupo.forEach((l) => batch.delete(doc(db, "historico_pontos", l.id)));
        await batch.commit();
      }

      const atletaIds = [...decrementoPorAtleta.entries()];
      for (let i = 0; i < atletaIds.length; i += TAMANHO_LOTE) {
        const grupo = atletaIds.slice(i, i + TAMANHO_LOTE);
        const batch = writeBatch(db);
        grupo.forEach(([atletaId, pontos]) => {
          batch.update(doc(db, "atletas", atletaId), {
            pontuacaoTotal: increment(-pontos),
            atualizadoEm: serverTimestamp(),
          });
          batch.set(
            atletaPublicoRef(atletaId),
            { pontuacaoTotal: increment(-pontos) },
            { merge: true },
          );
        });
        await batch.commit();
      }

      await logAudit({
        acao: "excluir_lancamento",
        entidade: "historico_pontos",
        entidadeId: alvoExclusao.length === 1 ? alvoExclusao[0].id : `lote_${alvoExclusao.length}_itens`,
        dados: {
          quantidade: alvoExclusao.length,
          itens: alvoExclusao.map((l) => ({
            id: l.id,
            atletaNome: l.atletaNome,
            regraDesc: l.regraDesc,
            pontos: l.pontos,
            dataTreino: l.dataTreino,
          })),
        },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });

      const rankingAtualizado = await atualizarRankingAutomaticamente(
        [...new Set(alvoExclusao.map((item) => item.atletaId))],
        "exclusao_lancamento",
      );
      show(
        rankingAtualizado ? "success" : "info",
        `${
          alvoExclusao.length === 1
            ? "Lançamento excluído permanentemente."
            : `${alvoExclusao.length} lançamentos excluídos permanentemente.`
        }${rankingAtualizado ? " Ranking atualizado." : " O ranking automático não atualizou; use \"Recalcular agora\"."}`,
      );
      setSelecionados(new Set());
      setAlvoExclusao(null);
    } catch {
      show("error", "Não foi possível excluir agora. Tente novamente.");
    }
  }

  const qtdSelecionados = selecionados.size;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Atleta</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={buscaAtleta}
                onChange={(e) => {
                  setBuscaAtleta(e.target.value);
                  aoMudarFiltro();
                }}
                placeholder="Digite o nome do atleta"
                enterKeyHint="search"
                autoComplete="off"
                className="h-11 w-full rounded-[var(--radius)] border border-border bg-bg-card pl-9 pr-3 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Registrado em</span>
            <span className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                type="date"
                value={dataRegistro}
                max={dataIsoLocal()}
                onChange={(e) => {
                  setDataRegistro(e.target.value);
                  aoMudarFiltro();
                }}
                className="h-11 w-full rounded-[var(--radius)] border border-border bg-bg-card pl-9 pr-3 text-base text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
              />
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Registrado por</span>
            <Select
              searchable
              value={pessoa}
              onChange={(e) => {
                setPessoa(e.target.value);
                aoMudarFiltro();
              }}
            >
              <option value="">Qualquer pessoa</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-light">
          <span aria-live="polite">
            {carregando
              ? "Carregando…"
              : semAtletaEncontrado
                ? "Nenhum atleta com esse nome."
                : `${plural(visiveis.length, "lançamento")}${
                    atletasDoFiltro && atletasDoFiltro.length === 1 ? ` de ${atletasDoFiltro[0].nome}` : ""
                  }${
                    atletasDoFiltro && atletasDoFiltro.length > 1 ? ` de ${atletasDoFiltro.length} atletas` : ""
                  }${dataRegistro ? ` registrados em ${formatDataTreino(dataRegistro)}` : ""}`}
          </span>
          {filtroAtivo ? (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:text-primary-hover"
            >
              <X className="size-3.5" />
              Limpar filtros
            </button>
          ) : null}
        </div>
      </Card>

      {isAdmin && qtdSelecionados > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/30 bg-danger/[0.04] py-3">
          <p className="text-sm font-semibold text-text">
            {qtdSelecionados} lançamento{qtdSelecionados === 1 ? "" : "s"} selecionado
            {qtdSelecionados === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelecionados(new Set())}
              className="flex items-center gap-1 text-xs font-semibold text-text-light hover:text-text"
            >
              <X className="size-3.5" />
              Limpar seleção
            </button>
            <button
              onClick={() => setAlvoExclusao(visiveis.filter((l) => selecionados.has(l.id)))}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-danger px-3 py-1.5 text-xs font-bold text-on-danger hover:bg-danger/90"
            >
              <Trash2 className="size-3.5" />
              Excluir selecionados
            </button>
          </div>
        </Card>
      )}

      {carregando ? (
        <Card className="h-64 animate-pulse" />
      ) : visiveis.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="Nenhum lançamento encontrado"
            description={
              semAtletaEncontrado
                ? "Confira o nome digitado."
                : filtroAtivo
                  ? temMais
                    ? "Nada com esses filtros entre os lançamentos carregados. Carregue mais para procurar nos anteriores."
                    : "Nenhum lançamento com esses filtros."
                  : "Os lançamentos de pontos aparecem aqui assim que forem registrados."
            }
          />
          {temMais && filtroAtivo && !semAtletaEncontrado ? (
            <div className="mt-2 flex justify-center">
              <Button variant="secondary" onClick={() => setQuantidade((q) => q + POR_PAGINA)}>
                Carregar mais {POR_PAGINA}
                <ChevronDown className="size-4" />
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                  {isAdmin && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={visiveis.length > 0 && visiveis.every((l) => selecionados.has(l.id))}
                        aria-label="Selecionar todos os lançamentos da lista"
                        onChange={toggleSelecionarTodos}
                        className="size-4 rounded border-border accent-danger"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-semibold">Atleta</th>
                  <th className="px-3 py-3 font-semibold">Regra</th>
                  <th className="px-3 py-3 font-semibold">Data</th>
                  <th className="px-3 py-3 text-right font-semibold">Pontos</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Registrado por</th>
                  <th className="px-3 py-3 font-semibold">Registrado em</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l, indice) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selecionados.has(l.id)}
                          onChange={(e) => toggleSelecionado(l.id, indice, (e.nativeEvent as MouseEvent).shiftKey)}
                          title="Dica: segure Shift e clique pra selecionar um intervalo"
                          className="size-4 rounded border-border accent-danger"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-text">{l.atletaNome}</td>
                    <td className="px-3 py-3 text-text-light">
                      <span>{l.regraDesc}</span>
                      {l.observacao ? (
                        <span className="mt-0.5 block max-w-72 whitespace-pre-wrap text-xs text-text-muted">
                          {l.observacao}
                        </span>
                      ) : null}
                      {l.justificativaAusenciaId ? (
                        <Badge tone="primary" className="mt-1.5">
                          Solicitada pelo atleta
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-text-light">{formatDataTreino(l.dataTreino, l.dataAproximada)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-text">
                      {l.estornado ? (
                        <span className="text-text-muted line-through">+{formatPontos(l.pontos)}</span>
                      ) : (
                        <span className="text-success">+{formatPontos(l.pontos)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={l.estornado ? "danger" : "success"}>
                        {l.estornado ? "Estornado" : "Válido"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-text-light">{l.criadoPorNome}</td>
                    <td className="px-3 py-3 text-text-light">{formatDateTime(l.criadoEm)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!l.estornado && (
                          <button
                            onClick={() => setAlvo(l)}
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                          >
                            <RotateCcw className="size-3.5" />
                            Estornar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setAlvoExclusao([l])}
                            aria-label="Excluir lançamento"
                            title="Excluir permanentemente"
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {temMais ? (
            <div className="flex flex-col items-center gap-2">
              <Button variant="secondary" onClick={() => setQuantidade((q) => q + POR_PAGINA)}>
                Carregar mais {POR_PAGINA}
                <ChevronDown className="size-4" />
              </Button>
              <p className="text-xs text-text-muted">
                {plural(lancamentos?.length ?? 0, "lançamento carregado", "lançamentos carregados")}, do mais recente para o mais antigo.
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-text-muted">Fim da lista.</p>
          )}
        </>
      )}

      <EstornarModal lancamento={alvo} onClose={() => setAlvo(null)} onConfirm={handleEstornar} />

      <ConfirmarPerigoModal
        open={alvoExclusao !== null}
        titulo={alvoExclusao && alvoExclusao.length > 1 ? `Excluir ${alvoExclusao.length} lançamentos` : "Excluir lançamento"}
        descricao={
          alvoExclusao && alvoExclusao.length > 1
            ? `Essa ação apaga permanentemente ${alvoExclusao.length} lançamentos selecionados e não pode ser desfeita.`
            : `Essa ação apaga permanentemente o lançamento de ${alvoExclusao?.[0]?.atletaNome} (${alvoExclusao?.[0]?.regraDesc}, +${formatPontos(alvoExclusao?.[0]?.pontos ?? 0)} pts) e não pode ser desfeita.`
        }
        palavraChave="EXCLUIR"
        onClose={() => setAlvoExclusao(null)}
        onConfirm={handleExcluir}
      />
    </div>
  );
}
