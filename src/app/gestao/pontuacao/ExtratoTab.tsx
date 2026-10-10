"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { Download, History, IdCard, RefreshCw, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { carregarTodosLancamentos, invalidarLancamentos } from "@/lib/lancamentosCache";
import { estornarLancamentos, excluirLancamentos, editarLancamento, editarLote } from "@/lib/lancamentosOperacoes";
import {
  agruparPorLote,
  extratoCsv,
  FILTRO_VAZIO,
  filtrarLancamentos,
  milisDoRegistro,
  mesDoLote,
  resumoDoExtrato,
  type FiltroExtrato,
  type LoteExtrato,
  type MudancasLancamento,
} from "@/lib/extrato";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { dataIsoLocal } from "@/lib/date";
import { equipeLabel } from "@/lib/labels";
import { formatKm, formatPontos, plural } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PainelNumeros } from "@/components/ui/PainelNumeros";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ConfirmarPerigoModal } from "@/components/ui/ConfirmarPerigoModal";
import { AvatarPessoa } from "@/components/atletas/AvatarAtleta";
import { FichaAtletaModal } from "../atletas/ficha/FichaAtletaModal";
import { EstornarModal } from "./EstornarModal";
import { FiltrosExtrato } from "./extrato/FiltrosExtrato";
import { LoteCard } from "./extrato/LoteCard";
import { LinhaLancamento } from "./extrato/LinhaLancamento";
import { EditarLancamentoModal } from "./extrato/EditarLancamentoModal";
import { EditarLoteModal } from "./extrato/EditarLoteModal";
import type { AtletaDoc, HistoricoPontoDoc, RegraPontuacaoDoc } from "@/lib/types";

const LOTES_POR_VEZ = 30;
const LINHAS_POR_VEZ = 60;

type Visao = "lotes" | "atletas";

/**
 * Extrato de pontos do comitê: cada lançamento numa linha (com os atletas
 * dentro), filtros por período, critério, situação, equipe e quem registrou,
 * totais do que está filtrado, correção no lugar e planilha.
 */
export function ExtratoTab() {
  const { uid, atleta: eu, usuario } = useActiveSession();
  const { show } = useToast();
  const isAdmin = usuario.role === "administrador";
  const autor = useMemo(() => ({ uid, nome: eu.nome }), [uid, eu.nome]);

  const [todos, setTodos] = useState<HistoricoPontoDoc[] | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroExtrato>(FILTRO_VAZIO);
  const [visao, setVisao] = useState<Visao>("lotes");
  const [limite, setLimite] = useState(LOTES_POR_VEZ);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ultimoIndice, setUltimoIndice] = useState<number | null>(null);
  const [editando, setEditando] = useState<HistoricoPontoDoc | null>(null);
  const [editandoLote, setEditandoLote] = useState<LoteExtrato | null>(null);
  const [estornando, setEstornando] = useState<HistoricoPontoDoc[] | null>(null);
  const [excluindo, setExcluindo] = useState<HistoricoPontoDoc[] | null>(null);
  const [ficha, setFicha] = useState<AtletaDoc | null>(null);

  const carregar = useCallback(async (forcar = false) => {
    if (forcar) invalidarLancamentos();
    setErro(false);
    try {
      setTodos(await carregarTodosLancamentos());
    } catch {
      setErro(true);
      setTodos((t) => t ?? []);
    }
  }, []);

  useEffect(() => {
    // Leitura inicial: o carregamento só chama setState quando a resposta chega.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "atletas"), (snap) =>
      setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
    );
    void getDocs(collection(db, "regras_pontuacao"))
      .then((snap) => setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc)))
      .catch(() => undefined);
    return unsub;
  }, []);

  // A busca espera a pessoa parar de digitar.
  const [buscaAplicada, setBuscaAplicada] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 200);
    return () => clearTimeout(t);
  }, [busca]);

  function mudarFiltro(f: FiltroExtrato) {
    setFiltro(f);
    setLimite(visao === "lotes" ? LOTES_POR_VEZ : LINHAS_POR_VEZ);
    setSelecionados(new Set());
  }

  const atletaPorId = useMemo(() => new Map((atletas ?? []).map((a) => [a.id, a])), [atletas]);
  // Perfis ocultos (Configurar portal) também não aparecem aqui, como antes.
  const visiveis = useMemo(
    () => (todos ?? []).filter((l) => {
      const a = atletaPorId.get(l.atletaId);
      return !a || perfilAtletaVisivel(a);
    }),
    [todos, atletaPorId],
  );
  const filtroCompleto = useMemo(() => ({ ...filtro, busca: buscaAplicada }), [filtro, buscaAplicada]);
  const filtrados = useMemo(() => filtrarLancamentos(visiveis, filtroCompleto), [visiveis, filtroCompleto]);
  const resumo = useMemo(() => resumoDoExtrato(filtrados), [filtrados]);
  const lotes = useMemo(() => (visao === "lotes" ? agruparPorLote(filtrados, filtro.campoData) : []), [filtrados, visao, filtro.campoData]);
  const linhas = useMemo(() => {
    if (visao !== "atletas") return [];
    const porTreino = filtro.campoData === "treino";
    return [...filtrados].sort((a, b) =>
      porTreino
        ? b.dataTreino.localeCompare(a.dataTreino) || milisDoRegistro(b) - milisDoRegistro(a)
        : milisDoRegistro(b) - milisDoRegistro(a),
    );
  }, [filtrados, visao, filtro.campoData]);

  // Um atleta só no resultado: resumo dele no topo, com atalho para a ficha.
  const atletaUnico = useMemo(() => {
    if (!buscaAplicada.trim() || resumo.atletas !== 1 || filtrados.length === 0) return null;
    return atletaPorId.get(filtrados[0].atletaId) ?? null;
  }, [buscaAplicada, resumo.atletas, filtrados, atletaPorId]);

  const criterios = useMemo(() => {
    const mapa = new Map(regras.map((r) => [r.id, r.descricao]));
    for (const l of todos ?? []) if (!mapa.has(l.regraId)) mapa.set(l.regraId, l.regraDesc);
    return [...mapa.entries()].map(([id, descricao]) => ({ id, descricao })).sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  }, [regras, todos]);

  const pessoas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const a of atletas ?? []) if ((a.role === "comite" || a.role === "administrador") && a.authUid) mapa.set(a.authUid, a.nome);
    for (const l of todos ?? []) if (l.criadoPor && !mapa.has(l.criadoPor)) mapa.set(l.criadoPor, l.criadoPorNome || "Sem nome");
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [atletas, todos]);

  async function depois(promessa: Promise<boolean | { ranking: boolean } | null>, ok: string) {
    const r = await promessa;
    const ranking = typeof r === "boolean" ? r : r === null ? true : r.ranking;
    show(ranking ? "success" : "info", ranking ? `${ok} Ranking atualizado.` : `${ok} O ranking automático não atualizou; use "Recalcular agora".`);
    await carregar(true);
  }

  async function salvarEdicao(m: MudancasLancamento, motivo: string) {
    if (!editando) return;
    try {
      const r = await editarLancamento(editando, m, autor, motivo);
      setEditando(null);
      if (!r) return;
      await depois(Promise.resolve(r), "Lançamento corrigido.");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível salvar a correção agora.");
    }
  }

  async function salvarEdicaoLote(dados: { descricaoLote: string; dataTreino: string }, motivo: string) {
    if (!editandoLote) return;
    try {
      const r = await editarLote(editandoLote.itens, { descricaoLote: dados.descricaoLote, dataTreino: dados.dataTreino || undefined }, autor, motivo);
      setEditandoLote(null);
      if (!r) return;
      await depois(Promise.resolve(r), "Lançamento corrigido.");
    } catch {
      show("error", "Não foi possível salvar a correção agora.");
    }
  }

  async function confirmarEstorno(motivo: string) {
    if (!estornando) return;
    try {
      const qtd = estornando.filter((l) => !l.estornado).length;
      await depois(estornarLancamentos(estornando, motivo, autor), qtd === 1 ? "Lançamento estornado." : `${qtd} lançamentos estornados.`);
      setEstornando(null);
    } catch {
      show("error", "Não foi possível estornar agora. Tente novamente.");
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      await depois(excluirLancamentos(excluindo, autor), excluindo.length === 1 ? "Lançamento excluído." : `${excluindo.length} lançamentos excluídos.`);
      setExcluindo(null);
      setSelecionados(new Set());
    } catch {
      show("error", "Não foi possível excluir agora. Tente novamente.");
    }
  }

  function exportar() {
    const blob = new Blob([extratoCsv(filtrados)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-pontos-${dataIsoLocal()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function marcar(id: string, indice: number, shift: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (shift && ultimoIndice !== null) {
        const ligar = !prev.has(id);
        for (let i = Math.min(ultimoIndice, indice); i <= Math.max(ultimoIndice, indice); i++) {
          if (!linhas[i]) continue;
          if (ligar) next.add(linhas[i].id);
          else next.delete(linhas[i].id);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setUltimoIndice(indice);
  }

  const carregando = todos === null;
  const temFiltro = Boolean(buscaAplicada.trim()) || JSON.stringify(filtro) !== JSON.stringify(FILTRO_VAZIO);
  const lotesVisiveis = lotes.slice(0, limite);
  const linhasVisiveis = linhas.slice(0, limite);
  const restantes = visao === "lotes" ? lotes.length - lotesVisiveis.length : linhas.length - linhasVisiveis.length;

  return (
    <div className="flex flex-col gap-4">
      <FiltrosExtrato filtro={filtro} busca={busca} onBusca={setBusca} onChange={mudarFiltro} criterios={criterios} pessoas={pessoas} />

      {erro ? (
        <InlineAlert tone="warning">
          Não foi possível carregar os lançamentos.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void carregar(true)}>
            Tentar de novo
          </button>
        </InlineAlert>
      ) : null}

      {atletaUnico ? (
        <Card className="flex items-center gap-3">
          <AvatarPessoa pessoa={atletaUnico} nome={atletaUnico.nome} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text">{atletaUnico.nome}</p>
            <p className="text-sm text-text-light">{equipeLabel[atletaUnico.equipe] ?? atletaUnico.equipe}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setFicha(atletaUnico)}>
            <IdCard className="size-4" aria-hidden="true" />
            Abrir ficha
          </Button>
        </Card>
      ) : null}

      {!carregando ? (
        <PainelNumeros
          itens={[
            { rotulo: "Lançamentos", valor: formatPontos(resumo.lancamentos), detalhe: plural(resumo.registros, "registro") },
            atletaUnico
              ? { rotulo: "Km", valor: resumo.km ? formatKm(resumo.km) : "—" }
              : { rotulo: "Atletas", valor: formatPontos(resumo.atletas) },
            { rotulo: "Pontos válidos", valor: formatPontos(resumo.pontosValidos), detalhe: !atletaUnico && resumo.km ? formatKm(resumo.km) : undefined },
            { rotulo: "Estornados", valor: `${formatPontos(resumo.pontosEstornados)} pts`, tom: resumo.pontosEstornados ? "danger" : undefined },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          value={visao}
          onChange={(v) => {
            setVisao(v);
            setLimite(v === "lotes" ? LOTES_POR_VEZ : LINHAS_POR_VEZ);
            setSelecionados(new Set());
          }}
          options={[
            { value: "lotes", label: "Por lançamento" },
            { value: "atletas", label: "Por atleta" },
          ]}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            loading={atualizando}
            onClick={async () => {
              setAtualizando(true);
              await carregar(true);
              setAtualizando(false);
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={exportar} disabled={filtrados.length === 0}>
            <Download className="size-4" aria-hidden="true" />
            Planilha
          </Button>
        </div>
      </div>

      {isAdmin && visao === "atletas" && selecionados.size > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/30 bg-danger/[0.04] py-3">
          <p className="text-sm font-semibold text-text">{plural(selecionados.size, "lançamento selecionado", "lançamentos selecionados")}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
              <X className="size-4" aria-hidden="true" />
              Limpar
            </Button>
            <Button variant="danger" size="sm" onClick={() => setExcluindo(linhas.filter((l) => selecionados.has(l.id)))}>
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir de vez
            </Button>
          </div>
        </Card>
      ) : null}

      {carregando ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-bg-inset" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="Nenhum lançamento encontrado"
            description={temFiltro ? "Nenhum lançamento com esses filtros. Tente mudar o período ou limpar os filtros." : "Os lançamentos de pontos aparecem aqui assim que forem registrados."}
          />
        </Card>
      ) : visao === "lotes" ? (
        <div className="flex flex-col gap-2">
          {lotesVisiveis.map((lote, i) => {
            const mes = mesDoLote(lote, filtro.campoData === "registro" ? "registro" : "treino");
            const mesAnterior = i > 0 ? mesDoLote(lotesVisiveis[i - 1], filtro.campoData === "registro" ? "registro" : "treino") : null;
            return (
              <div key={lote.id} className="flex flex-col gap-2">
                {mes !== mesAnterior ? <h3 className="px-1 pt-2 text-xs font-bold uppercase tracking-wide text-text-muted">{mes}</h3> : null}
                <ul>
                  <LoteCard
                    lote={lote}
                    podeExcluir={isAdmin}
                    onEditarLote={setEditandoLote}
                    onEstornarLote={(lt) => setEstornando(lt.itens)}
                    onExcluirLote={(lt) => setExcluindo(lt.itens)}
                    onEditar={setEditando}
                    onEstornar={(l) => setEstornando([l])}
                    onExcluir={(l) => setExcluindo([l])}
                  />
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="px-4 py-1">
          <ul className="divide-y divide-border-subtle">
            {linhasVisiveis.map((l, i) => (
              <li key={l.id}>
                <LinhaLancamento
                  lancamento={l}
                  modo="atleta"
                  onEditar={setEditando}
                  onEstornar={(x) => setEstornando([x])}
                  onExcluir={isAdmin ? (x) => setExcluindo([x]) : undefined}
                  selecao={isAdmin ? { marcado: selecionados.has(l.id), onChange: (shift) => marcar(l.id, i, shift) } : undefined}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!carregando && filtrados.length > 0 ? (
        restantes > 0 ? (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => setLimite((n) => n + (visao === "lotes" ? LOTES_POR_VEZ : LINHAS_POR_VEZ))}>
              Mostrar mais ({formatPontos(restantes)})
            </Button>
          </div>
        ) : (
          <p className="text-center text-xs text-text-muted">Fim da lista.</p>
        )
      ) : null}

      <EditarLancamentoModal lancamento={editando} regras={regras} onClose={() => setEditando(null)} onSalvar={salvarEdicao} />
      <EditarLoteModal lote={editandoLote} onClose={() => setEditandoLote(null)} onSalvar={salvarEdicaoLote} />
      <EstornarModal itens={estornando} onClose={() => setEstornando(null)} onConfirm={confirmarEstorno} />
      <ConfirmarPerigoModal
        open={excluindo !== null}
        titulo={excluindo && excluindo.length > 1 ? `Excluir ${excluindo.length} lançamentos` : "Excluir lançamento"}
        descricao={
          excluindo && excluindo.length > 1
            ? `Apaga de vez ${excluindo.length} lançamentos e não pode ser desfeito. Para corrigir um dado, use Editar; para anular mantendo o registro, use Estornar.`
            : `Apaga de vez o lançamento de ${excluindo?.[0]?.atletaNome} (${excluindo?.[0]?.regraDesc}, +${formatPontos(excluindo?.[0]?.pontos ?? 0)} pts) e não pode ser desfeito.`
        }
        palavraChave="EXCLUIR"
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExclusao}
      />
      {ficha ? <FichaAtletaModal atleta={ficha} initialTab="lancamentos" onClose={() => setFicha(null)} /> : null}
    </div>
  );
}
