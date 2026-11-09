"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumero } from "@/lib/format";
import { MEDIDAS, temOrdemNatural, variacao, type Dimensao, type LinhaResultado, type Medida, type ResultadoAnalise } from "@/lib/analises/motor";

export function formatValor(medida: Medida, v: number | null | undefined) {
  if (v == null) return "—";
  const u = MEDIDAS[medida].unidade;
  if (u === "%") return `${formatNumero(v, 0)}%`;
  if (u === "km") return `${formatNumero(v, 1)} km`;
  return formatNumero(v, 1);
}

export function formatVariacao(medida: Medida, atual: number | null | undefined, anterior: number | null | undefined) {
  const v = variacao(atual, anterior);
  if (!v) return null;
  const sinal = v.abs > 0 ? "+" : v.abs < 0 ? "−" : "";
  const abs = MEDIDAS[medida].unidade === "%" ? `${formatNumero(Math.abs(v.abs), 0)} p.p.` : formatValor(medida, Math.abs(v.abs));
  return { texto: `${sinal}${abs}`, pct: v.pct == null ? null : `${v.pct > 0 ? "+" : v.pct < 0 ? "−" : ""}${Math.abs(v.pct)}%`, tom: v.abs > 0 ? "sobe" : v.abs < 0 ? "desce" : "igual" };
}

function Variacao({ medida, atual, anterior, className }: { medida: Medida; atual: number | null | undefined; anterior: number | null | undefined; className?: string }) {
  const v = formatVariacao(medida, atual, anterior);
  if (!v) return <span className={cn("text-text-muted", className)}>—</span>;
  return (
    <span className={cn("font-semibold tabular-nums", v.tom === "sobe" ? "text-success" : v.tom === "desce" ? "text-danger" : "text-text-light", className)}>
      {v.texto}
      {v.pct ? <span className="ml-1 text-xs font-medium opacity-80">({v.pct})</span> : null}
    </span>
  );
}

const LIMITE_GRAFICO = 15;

/* ---------- Gráfico ---------- */

export function Grafico({ resultado, medida, linhas, comparando, porVariacao, rotuloAtual, rotuloAnterior }: { resultado: ResultadoAnalise; medida: Medida; linhas: Dimensao; comparando: boolean; porVariacao: boolean; rotuloAtual: string; rotuloAnterior: string | null }) {
  const itens = resultado.linhas;
  if (!itens.length || resultado.colunas) return null;
  const vertical = temOrdemNatural(linhas) && itens.length <= 24;
  const visiveis = vertical ? itens : itens.slice(0, LIMITE_GRAFICO);
  const maximo = Math.max(1, ...visiveis.flatMap((l) => [l.valor ?? 0, comparando ? (l.anterior ?? 0) : 0]));
  // Meses do mesmo ano: o eixo não precisa repetir o ano ("mar", não "mar/26").
  const mesmoAno = linhas === "mes" && new Set(visiveis.map((l) => l.chave.slice(0, 4))).size === 1;
  const rotuloEixo = (l: LinhaResultado) => (linhas === "diaSemana" ? l.rotulo.slice(0, 3) : mesmoAno ? l.rotulo.split("/")[0] : l.rotulo);

  const legenda = comparando ? (
    <div className="flex flex-wrap gap-4 text-xs text-text-secondary" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-[2px] bg-primary" />
        {rotuloAtual}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-[2px] bg-text-muted/50" />
        {rotuloAnterior}
      </span>
    </div>
  ) : null;

  if (vertical) {
    return (
      <figure className="flex flex-col gap-3">
        {legenda}
        <div className="flex h-56 items-end gap-1.5 border-b border-border pb-px sm:gap-3" role="img" aria-label={`Gráfico: ${MEDIDAS[medida].rotulo.toLowerCase()} por ${linhas === "mes" ? "mês" : "dia da semana"}`}>
          {visiveis.map((l) => (
            <div key={l.chave} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${l.rotulo}: ${formatValor(medida, l.valor)}${comparando ? ` (antes: ${formatValor(medida, l.anterior)})` : ""}`}>
              <span className="text-[11px] font-semibold tabular-nums text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 sm:text-xs sm:opacity-100">
                {l.valor ? formatNumero(l.valor, 1) : ""}
              </span>
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                {comparando ? <div className="w-full max-w-5 rounded-t-[4px] bg-text-muted/40" style={{ height: `${((l.anterior ?? 0) / maximo) * 100}%` }} /> : null}
                <div className="w-full max-w-8 rounded-t-[4px] bg-primary transition-[height] duration-300 motion-reduce:transition-none" style={{ height: `${((l.valor ?? 0) / maximo) * 100}%`, minHeight: l.valor ? 2 : 0 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 sm:gap-3" aria-hidden="true">
          {visiveis.map((l) => (
            <span key={l.chave} className="min-w-0 flex-1 truncate text-center text-[11px] text-text-light sm:text-xs">
              {rotuloEixo(l)}
            </span>
          ))}
        </div>
      </figure>
    );
  }

  return (
    <figure className="flex flex-col gap-3">
      {legenda}
      <ol className="flex flex-col gap-2.5" aria-label="Gráfico de barras">
        {visiveis.map((l) => (
          <li key={l.chave} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_5.5rem]">
            <span className="truncate text-sm text-text" title={l.rotulo}>
              {l.rotulo}
            </span>
            <div className="flex flex-col gap-1">
              <div className="h-3 rounded-r-[4px] bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((l.valor ?? 0) / maximo) * 100}%`, minWidth: l.valor ? 2 : 0 }} />
              {comparando ? <div className="h-1.5 rounded-r-[4px] bg-text-muted/40" style={{ width: `${((l.anterior ?? 0) / maximo) * 100}%` }} /> : null}
            </div>
            {porVariacao ? (
              <Variacao medida={medida} atual={l.valor} anterior={l.anterior} className="text-right text-sm" />
            ) : (
              <span className="text-right text-sm font-semibold tabular-nums text-text">{formatValor(medida, l.valor)}</span>
            )}
          </li>
        ))}
      </ol>
      {itens.length > visiveis.length ? <figcaption className="text-xs text-text-light">O gráfico mostra os {LIMITE_GRAFICO} primeiros. A tabela abaixo tem todos.</figcaption> : null}
    </figure>
  );
}

/* ---------- Tabela simples (com ordenação) ---------- */

type Ordem = "padrao" | "rotulo" | "valor" | "anterior" | "variacao";

function CabecalhoOrdenavel({ rotulo, campo, ordem, setOrdem, alinhar = "right" }: { rotulo: string; campo: Ordem; ordem: { campo: Ordem; desc: boolean }; setOrdem: (o: { campo: Ordem; desc: boolean }) => void; alinhar?: "left" | "right" }) {
  const ativo = ordem.campo === campo;
  const Icone = ativo ? (ordem.desc ? ArrowDown : ArrowUp) : ChevronsUpDown;
  return (
    <th scope="col" aria-sort={ativo ? (ordem.desc ? "descending" : "ascending") : "none"} className={cn("px-3 py-2.5 font-semibold", alinhar === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={() => setOrdem({ campo, desc: ativo ? !ordem.desc : campo !== "rotulo" })}
        className={cn("inline-flex items-center gap-1 rounded-sm hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", alinhar === "right" && "flex-row-reverse")}
      >
        {rotulo}
        <Icone className={cn("size-3.5", !ativo && "opacity-40")} aria-hidden="true" />
      </button>
    </th>
  );
}

export function TabelaResultado({ resultado, medida, rotuloLinha, comparando, porVariacao, mostrarPosicao }: { resultado: ResultadoAnalise; medida: Medida; rotuloLinha: string; comparando: boolean; porVariacao: boolean; mostrarPosicao: boolean }) {
  const [ordem, setOrdem] = useState<{ campo: Ordem; desc: boolean }>({ campo: "padrao", desc: true });
  const linhas = useMemo(() => {
    if (ordem.campo === "padrao") return resultado.linhas;
    const valor = (l: LinhaResultado) =>
      ordem.campo === "valor" ? l.valor : ordem.campo === "anterior" ? l.anterior : ordem.campo === "variacao" ? (variacao(l.valor, l.anterior)?.abs ?? null) : null;
    return [...resultado.linhas].sort((a, b) => {
      if (ordem.campo === "rotulo") return (ordem.desc ? -1 : 1) * a.rotulo.localeCompare(b.rotulo, "pt-BR");
      const va = valor(a) ?? -Infinity;
      const vb = valor(b) ?? -Infinity;
      return (ordem.desc ? vb - va : va - vb) || a.rotulo.localeCompare(b.rotulo, "pt-BR");
    });
  }, [resultado.linhas, ordem]);
  // Posição no ranking (empates dividem a posição): pelo valor ou, em "maior evolução", pela variação.
  const posicoes = useMemo(() => {
    const chave = (l: LinhaResultado) => (porVariacao ? (variacao(l.valor, l.anterior)?.abs ?? -Infinity) : (l.valor ?? -Infinity));
    const mapa = new Map<string, number>();
    const ordenados = [...resultado.linhas].sort((a, b) => chave(b) - chave(a));
    ordenados.forEach((l, i) => mapa.set(l.chave, i > 0 && chave(ordenados[i - 1]) === chave(l) ? mapa.get(ordenados[i - 1].chave)! : i + 1));
    return mapa;
  }, [resultado.linhas, porVariacao]);

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead className="border-b border-border text-xs text-text-light">
          <tr>
            {mostrarPosicao ? <th scope="col" className="w-10 px-3 py-2.5 text-left font-semibold">#</th> : null}
            <CabecalhoOrdenavel rotulo={rotuloLinha} campo="rotulo" ordem={ordem} setOrdem={setOrdem} alinhar="left" />
            <CabecalhoOrdenavel rotulo={MEDIDAS[medida].rotulo} campo="valor" ordem={ordem} setOrdem={setOrdem} />
            {comparando ? <CabecalhoOrdenavel rotulo="Antes" campo="anterior" ordem={ordem} setOrdem={setOrdem} /> : null}
            {comparando ? <CabecalhoOrdenavel rotulo="Variação" campo="variacao" ordem={ordem} setOrdem={setOrdem} /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {linhas.map((l) => (
            <tr key={l.chave} className="hover:bg-bg-inset/50">
              {mostrarPosicao ? <td className="px-3 py-2.5 tabular-nums text-text-light">{l.valor || porVariacao ? `${posicoes.get(l.chave)}º` : ""}</td> : null}
              <td className="px-3 py-2.5">
                <span className="font-medium text-text">{l.rotulo}</span>
                {l.detalhe ? <span className="ml-2 text-xs text-text-light">{l.detalhe}</span> : null}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text">{formatValor(medida, l.valor)}</td>
              {comparando ? <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{formatValor(medida, l.anterior)}</td> : null}
              {comparando ? (
                <td className="px-3 py-2.5 text-right">
                  <Variacao medida={medida} atual={l.valor} anterior={l.anterior} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tabela cruzada (linhas × colunas) ---------- */

export function TabelaCruzada({ resultado, medida, rotuloLinha }: { resultado: ResultadoAnalise; medida: Medida; rotuloLinha: string }) {
  const colunas = resultado.colunas ?? [];
  const maximo = Math.max(1, ...resultado.linhas.flatMap((l) => Object.values(l.celulas ?? {}).map((v) => v ?? 0)));
  const totalLabel = MEDIDAS[medida].agregacao === "soma" ? "Total" : MEDIDAS[medida].agregacao === "maximo" ? "Maior" : MEDIDAS[medida].agregacao === "contagem" ? "Total" : "Média";
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-border text-xs text-text-light">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-bg-card px-3 py-2.5 text-left font-semibold">
              {rotuloLinha}
            </th>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">
                {c.rotulo}
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right font-semibold text-text">
              {totalLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {resultado.linhas.map((l) => (
            <tr key={l.chave}>
              <th scope="row" className="sticky left-0 z-10 max-w-[12rem] truncate bg-bg-card px-3 py-2 text-left font-medium text-text" title={l.rotulo}>
                {l.rotulo}
              </th>
              {colunas.map((c) => {
                const v = l.celulas?.[c.chave] ?? null;
                const intensidade = v ? 0.08 + (v / maximo) * 0.55 : 0;
                return (
                  <td
                    key={c.chave}
                    className={cn("whitespace-nowrap px-2 py-2 text-right tabular-nums shadow-[inset_0_0_0_1px_var(--color-bg-card)]", v ? "text-text" : "text-text-muted", intensidade > 0.4 && "font-semibold")}
                    style={intensidade ? { backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.round(intensidade * 100)}%, transparent)` } : undefined}
                    title={`${l.rotulo}, ${c.rotulo}: ${formatValor(medida, v)}`}
                  >
                    {v ? formatNumero(v, 1) : "·"}
                  </td>
                );
              })}
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-text">{formatValor(medida, l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
