"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { ChartColumnBig, Download, Link2, RotateCcw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { temPermissao } from "@/lib/permissoes";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import { useDiasTreino } from "@/lib/useDiasTreino";
import { useTrimestresDoCalendario } from "@/lib/useTrimestresDoCalendario";
import { hojeBrasil } from "@/lib/calendarioPremiacao";
import { exportToExcel } from "@/lib/excel";
import { equipeLabel, tipoLancamentoLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";
import {
  ESCOLHA_PADRAO,
  PRONTAS,
  configDaEscolha,
  escreverEscolha,
  lerEscolha,
  prontaAtiva,
  resolverPeriodo,
  type EscolhaAnalise,
} from "@/lib/analises/config";
import { DIMENSOES, MEDIDAS, combinacaoInvalida, executarAnalise, variacao } from "@/lib/analises/motor";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PainelNumeros } from "@/components/ui/PainelNumeros";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { Construtor } from "./Construtor";
import { Grafico, TabelaCruzada, TabelaResultado, formatValor, formatVariacao } from "./Resultado";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc, RegraPontuacaoDoc } from "@/lib/types";

interface Dados {
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumos: HistoricoMensalDoc[];
  regras: RegraPontuacaoDoc[];
}

export default function AnalisesPage() {
  const { usuario } = useActiveSession();
  const pode = temPermissao(usuario, "analises");
  if (!pode) return <NotAuthorized />;
  return <Analises />;
}

function Analises() {
  const { show } = useToast();
  const regrasTreino = useRegrasDeTreino();
  const diasTreino = useDiasTreino();
  const trimestres = useTrimestresDoCalendario();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [escolha, setEscolha] = useState<EscolhaAnalise | null>(null);

  // A análise montada fica na URL: dá para salvar nos favoritos ou mandar o link.
  useEffect(() => {
    const id = window.setTimeout(() => setEscolha(lerEscolha(window.location.search)), 0);
    return () => window.clearTimeout(id);
  }, []);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const [atletasSnap, lancamentos, resumosSnap, regrasSnap] = await Promise.all([
        getDocs(collection(db, "atletas")),
        carregarTodosLancamentos(),
        getDocs(collection(db, "historico_mensal")),
        getDocs(collection(db, "regras_pontuacao")),
      ]);
      setDados({
        atletas: atletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc),
        lancamentos,
        resumos: resumosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoMensalDoc),
        regras: regrasSnap.docs.map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id })),
      });
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(id);
  }, [carregar]);

  const mudar = useCallback((parcial: Partial<EscolhaAnalise>) => {
    setEscolha((atual) => {
      const nova = { ...(atual ?? ESCOLHA_PADRAO), ...parcial };
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${escreverEscolha(nova)}`);
      return nova;
    });
  }, []);

  const hoje = hojeBrasil();
  const periodo = useMemo(() => (escolha ? resolverPeriodo(escolha, hoje, trimestres) : null), [escolha, hoje, trimestres]);
  const invalida = escolha ? (combinacaoInvalida(escolha.medida, escolha.linhas) ?? combinacaoInvalida(escolha.medida, escolha.colunas)) : null;

  const resultado = useMemo(() => {
    if (!escolha || !periodo || !dados || !regrasTreino || invalida) return null;
    return executarAnalise(configDaEscolha(escolha, periodo), {
      atletas: dados.atletas,
      lancamentos: dados.lancamentos,
      resumos: dados.resumos,
      regrasTreino,
      diasTreino,
      hoje,
    });
  }, [escolha, periodo, dados, regrasTreino, diasTreino, hoje, invalida]);

  const criterios = useMemo(
    () => (dados?.regras ?? []).map((r) => ({ id: r.id, descricao: r.descricao })).sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
    [dados],
  );

  if (!escolha || !periodo) return null;
  const medida = MEDIDAS[escolha.medida];
  const comparando = escolha.comparar && !escolha.colunas && !!periodo.anterior;
  const ativa = prontaAtiva(escolha);
  const modoMedia = escolha.modo === "media" && medida.agregacao === "soma" && escolha.linhas !== "atleta";
  const titulo = `${medida.rotulo}${modoMedia ? " (média por atleta)" : ""} por ${DIMENSOES[escolha.linhas].curto}${escolha.colunas ? ` e ${DIMENSOES[escolha.colunas].curto}` : ""}`;
  const criterioNome = criterios.find((c) => c.id === escolha.criterio)?.descricao;
  const filtrosTexto = [
    escolha.equipe !== "todas" ? equipeLabel[escolha.equipe] : null,
    escolha.somenteAtivos ? "só ativos" : "ativos e inativos",
    escolha.sexo !== "todos" ? (escolha.sexo === "F" ? "feminino" : "masculino") : null,
    criterioNome ? `critério ${criterioNome}` : null,
    escolha.tipo ? `lançados como ${tipoLancamentoLabel[escolha.tipo]}` : null,
    escolha.minimo != null ? `a partir de ${formatValor(escolha.medida, escolha.minimo)}` : null,
    escolha.top != null ? `top ${escolha.top}` : null,
  ].filter(Boolean);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      show("success", "Link copiado. Quem tiver acesso a Análises abre a mesma análise.");
    } catch {
      show("info", "Não deu para copiar. Copie o endereço da barra do navegador.");
    }
  }

  async function exportar() {
    if (!resultado || !escolha) return;
    const rotuloLinha = DIMENSOES[escolha.linhas].rotulo;
    const linhas = resultado.linhas.map((l) => {
      const base: Record<string, unknown> = { [rotuloLinha]: l.rotulo };
      if (l.detalhe) base.Equipe = l.detalhe;
      if (resultado.colunas) for (const c of resultado.colunas) base[c.rotulo] = l.celulas?.[c.chave] ?? null;
      base[resultado.colunas ? "Total" : medida.rotulo] = l.valor;
      if (comparando) {
        base[`${medida.rotulo} antes`] = l.anterior ?? null;
        base["Variação"] = variacao(l.valor, l.anterior)?.abs ?? null;
        base["Variação (%)"] = variacao(l.valor, l.anterior)?.pct ?? null;
      }
      return base;
    });
    await exportToExcel(`analise-${escolha.medida}-por-${escolha.linhas}-${periodo!.periodo.de}.xlsx`, "Análise", linhas);
  }

  const totalRotulo = { soma: modoMedia ? "Média por atleta" : "Total", media: "Média", maximo: "Maior", contagem: "Total" }[medida.agregacao];
  const comValor = resultado?.linhas.filter((l) => (l.valor ?? 0) > 0) ?? [];
  const porVariacao = comparando && escolha.ordem === "variacao" && escolha.linhas !== "mes" && escolha.linhas !== "diaSemana";
  const lider = !resultado?.colunas && resultado?.linhas.length && !["mes", "diaSemana"].includes(escolha.linhas) ? (porVariacao ? resultado.linhas[0] : [...resultado.linhas].sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))[0]) : null;
  const variacaoLider = lider && porVariacao ? formatVariacao(escolha.medida, lider.valor, lider.anterior) : null;
  const variacaoTotal = comparando && resultado ? formatVariacao(escolha.medida, resultado.total, resultado.totalAnterior) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Análises"
        subtitle="Monte a pergunta e veja a resposta em gráfico e tabela: para premiações, reuniões e para olhar mais a fundo."
        icon={ChartColumnBig}
      />

      <section aria-labelledby="prontas-titulo" className="flex flex-col gap-2.5">
        <h2 id="prontas-titulo" className="text-sm font-bold text-text">
          Comece por uma pronta
        </h2>
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {PRONTAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => mudar({ ...ESCOLHA_PADRAO, ...p.escolha })}
              aria-pressed={ativa === p.id}
              className={cn(
                "flex w-48 shrink-0 snap-start flex-col gap-0.5 rounded-[var(--radius-lg)] border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto",
                ativa === p.id ? "border-primary bg-primary-subtle" : "border-border bg-bg-card hover:border-primary/40 hover:bg-bg-inset/60",
              )}
            >
              <span className={cn("text-sm font-semibold", ativa === p.id ? "text-primary" : "text-text")}>{p.titulo}</span>
              <span className="text-xs text-text-light [text-wrap:pretty]">{p.descricao}</span>
            </button>
          ))}
        </div>
      </section>

      <Construtor escolha={escolha} mudar={mudar} criterios={criterios} />

      {erro ? (
        <InlineAlert tone="danger">
          Não foi possível carregar os dados agora.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </InlineAlert>
      ) : null}

      {invalida ? null : !resultado ? (
        erro ? null : <Card className="h-72 animate-pulse" aria-label="Calculando" />
      ) : (
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-tight text-text [text-wrap:balance]">{titulo}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                <span className="first-letter:uppercase">{periodo.titulo}</span>
                {comparando ? `, comparado com ${periodo.tituloAnterior}` : ""}
              </p>
              <p className="text-xs text-text-light first-letter:uppercase">{filtrosTexto.join(", ")}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={() => void copiarLink()}>
                <Link2 className="size-4" aria-hidden="true" />
                Copiar link
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void exportar()} disabled={!resultado.linhas.length}>
                <Download className="size-4" aria-hidden="true" />
                Excel
              </Button>
            </div>
          </div>

          {resultado.semResumoMensal ? (
            <InlineAlert tone="info">Com filtro de critério ou tipo, o Histórico mensal fica de fora: ele guarda só os totais do mês, sem o critério.</InlineAlert>
          ) : null}
          {escolha.medida === "aderencia" && diasTreino && !diasTreino.corrida.dias.length && !diasTreino.bicicleta.dias.length ? (
            <InlineAlert tone="warning">A agenda de treinos não está configurada: sem treinos previstos, não há aderência para calcular. Configure em Configurar portal.</InlineAlert>
          ) : null}
          {comparando && periodo.emAndamento ? (
            <InlineAlert tone="info">O período ainda não terminou: para a comparação ser justa, o anterior conta o mesmo número de dias, desde o começo dele.</InlineAlert>
          ) : null}

          {resultado.linhas.length === 0 ? (
            <EmptyState
              icon={ChartColumnBig}
              title="Nada para mostrar com esses filtros"
              description={resultado.linhasAntesDoCorte > 0 ? "Ninguém chegou ao mínimo escolhido. Diminua o mínimo ou tire o filtro." : "Não há lançamentos no período escolhido."}
              action={
                escolha.minimo != null ? (
                  <Button variant="secondary" size="sm" onClick={() => mudar({ minimo: null })}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Tirar o mínimo
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <PainelNumeros
                emLinhasNoCelular={!!lider}
                itens={[
                  {
                    rotulo: totalRotulo,
                    valor: formatValor(escolha.medida, resultado.total),
                    detalhe: variacaoTotal ? `${variacaoTotal.texto} sobre ${periodo.tituloAnterior}` : undefined,
                    tom: variacaoTotal ? (variacaoTotal.tom === "sobe" ? "success" : variacaoTotal.tom === "desce" ? "danger" : undefined) : undefined,
                  },
                  lider
                    ? porVariacao
                      ? { rotulo: "Maior evolução", valor: lider.rotulo, detalhe: variacaoLider ? `${variacaoLider.texto} (${formatValor(escolha.medida, lider.anterior)} para ${formatValor(escolha.medida, lider.valor)})` : undefined }
                      : { rotulo: "Primeiro lugar", valor: lider.rotulo, detalhe: formatValor(escolha.medida, lider.valor) }
                    : { rotulo: `${DIMENSOES[escolha.linhas].rotulo} com valor`, valor: `${comValor.length} de ${resultado.linhas.length}` },
                  { rotulo: "Atletas no filtro", valor: String(resultado.atletasNoFiltro) },
                ]}
              />
              {resultado.colunas ? (
                <TabelaCruzada resultado={resultado} medida={escolha.medida} rotuloLinha={DIMENSOES[escolha.linhas].rotulo} />
              ) : (
                <>
                  <Grafico resultado={resultado} medida={escolha.medida} linhas={escolha.linhas} comparando={comparando} porVariacao={porVariacao} rotuloAtual={periodo.titulo} rotuloAnterior={periodo.tituloAnterior} />
                  <TabelaResultado
                    key={`${escolha.medida}-${escolha.linhas}`}
                    resultado={resultado}
                    medida={escolha.medida}
                    rotuloLinha={DIMENSOES[escolha.linhas].rotulo}
                    comparando={comparando}
                    porVariacao={porVariacao}
                    mostrarPosicao={escolha.linhas === "atleta"}
                  />
                </>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
