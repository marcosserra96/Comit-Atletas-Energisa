"use client";

import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useMenuDeContexto, type AcaoDoMenu } from "@/components/ui/MenuAcoes";
import { cn } from "@/lib/cn";
import { formatKm, formatPontos } from "@/lib/format";
import { camposEditaveis, dataCurta, momentoDoRegistro, type LancamentoComEdicao } from "@/lib/extrato";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinhaLancamento } from "./LinhaLancamento";
import type { HistoricoPontoDoc } from "@/lib/types";

const icone =
  "inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * A visão de tabela do extrato (a de antes): um lançamento por linha, com
 * todas as colunas à vista e as ações na própria linha. No celular, vira a
 * lista de cartões, porque nove colunas não cabem.
 */
export function TabelaLancamentos({
  linhas,
  onEditar,
  onEstornar,
  onExcluir,
  selecao,
}: {
  linhas: HistoricoPontoDoc[];
  onEditar: (l: HistoricoPontoDoc) => void;
  onEstornar: (l: HistoricoPontoDoc) => void;
  /** Só administrador. */
  onExcluir?: (l: HistoricoPontoDoc) => void;
  selecao?: { marcados: Set<string>; onMarcar: (id: string, indice: number, shift: boolean) => void; onTodos: (marcar: boolean) => void };
}) {
  const menuContexto = useMenuDeContexto();
  const todosMarcados = !!selecao && linhas.length > 0 && linhas.every((l) => selecao.marcados.has(l.id));
  return (
    <>
      {menuContexto.menu}
      <Card className="hidden overflow-x-auto p-0 xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b border-border text-left text-xs text-text-muted">
              {selecao ? (
                <th className="w-10 py-3 pl-4">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={(e) => selecao.onTodos(e.target.checked)}
                    aria-label="Selecionar todos os lançamentos da lista"
                    className="size-4 rounded border-border accent-danger"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-semibold">Atleta</th>
              <th className="px-3 py-3 font-semibold">Critério</th>
              <th className="px-3 py-3 font-semibold">Data</th>
              <th className="px-3 py-3 text-right font-semibold">Km</th>
              <th className="px-3 py-3 text-right font-semibold">Pontos</th>
              <th className="px-3 py-3 font-semibold">Situação</th>
              <th className="px-3 py-3 font-semibold">Registrado</th>
              <th className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((lanc, indice) => {
              const l = lanc as LancamentoComEdicao;
              const editavel = camposEditaveis(l).observacao;
              const acoes: AcaoDoMenu[] = [
                ...(editavel ? [{ rotulo: "Editar", icone: Pencil, onSelect: () => onEditar(l) }] : []),
                ...(!l.estornado ? [{ rotulo: "Estornar", icone: RotateCcw, onSelect: () => onEstornar(l), perigo: true }] : []),
                ...(onExcluir ? [{ rotulo: "Excluir de vez", icone: Trash2, onSelect: () => onExcluir(l), perigo: true }] : []),
              ];
              const ultimaEdicao = l.edicoes?.[l.edicoes.length - 1];
              return (
                <tr key={l.id} onContextMenu={menuContexto.abrir(acoes, `Ações do lançamento de ${l.atletaNome}`)} className={cn("border-b border-border-subtle align-top last:border-0 hover:bg-bg-inset/40", l.estornado && "text-text-muted")}>
                  {selecao ? (
                    <td className="py-3 pl-4">
                      <input
                        type="checkbox"
                        checked={selecao.marcados.has(l.id)}
                        onChange={(e) => selecao.onMarcar(l.id, indice, (e.nativeEvent as MouseEvent).shiftKey)}
                        aria-label={`Selecionar lançamento de ${l.atletaNome}`}
                        title="Segure Shift para marcar um intervalo"
                        className="size-4 rounded border-border accent-danger"
                      />
                    </td>
                  ) : null}
                  <td className="max-w-52 px-4 py-3 font-medium text-text">{l.atletaNome}</td>
                  <td className="min-w-48 max-w-80 px-3 py-3 text-text-light">
                    <span className="block">{l.regraDesc}</span>
                    {l.descricaoLote && l.descricaoLote !== l.regraDesc ? <span className="block text-xs text-text-muted">{l.descricaoLote}</span> : null}
                    {l.observacao ? <span className="mt-0.5 block whitespace-pre-wrap text-xs text-text-muted">{l.observacao}</span> : null}
                    {l.justificativaAusenciaId ? (
                      <Badge tone="primary" className="mt-1.5">
                        Solicitada pelo atleta
                      </Badge>
                    ) : null}
                    {ultimaEdicao ? (
                      <span className="mt-1 block text-xs text-text-muted" title={l.edicoes!.map((e) => `${e.porNome}: ${e.resumo}`).join("\n")}>
                        Editado por {ultimaEdicao.porNome.split(" ")[0]} · {ultimaEdicao.resumo}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-text-light">
                    {dataCurta(l.dataTreino)}
                    {l.dataAproximada ? <span className="text-xs text-text-muted"> (aprox.)</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-light">{l.kmPercorrido ? formatKm(l.kmPercorrido) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">
                    <span className={l.estornado ? "text-text-muted line-through" : l.pontos > 0 ? "text-success" : "text-text-light"}>
                      {l.pontos > 0 ? "+" : ""}
                      {formatPontos(l.pontos)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={l.estornado ? "danger" : "success"}>{l.estornado ? "Estornado" : "Válido"}</Badge>
                    {l.estornado && l.motivoEstorno ? <span className="mt-1 block max-w-40 text-xs text-text-muted">{l.motivoEstorno}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-text-light">
                    <span className="block">{l.criadoPorNome || "—"}</span>
                    <span className="block text-xs text-text-muted">{momentoDoRegistro(l)}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {editavel ? (
                        <button type="button" onClick={() => onEditar(l)} title="Editar" aria-label={`Editar lançamento de ${l.atletaNome}`} className={cn(icone, "hover:bg-bg-inset hover:text-text")}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      {!l.estornado ? (
                        <button type="button" onClick={() => onEstornar(l)} title="Estornar" aria-label={`Estornar lançamento de ${l.atletaNome}`} className={cn(icone, "text-danger/80 hover:bg-danger/10 hover:text-danger")}>
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      {onExcluir ? (
                        <button type="button" onClick={() => onExcluir(l)} title="Excluir de vez" aria-label={`Excluir lançamento de ${l.atletaNome}`} className={cn(icone, "hover:bg-danger/10 hover:text-danger")}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Celular e telas estreitas: a mesma lista, em cartões. */}
      <Card className="px-4 py-1 xl:hidden">
        <ul className="divide-y divide-border-subtle">
          {linhas.map((l, i) => (
            <li key={l.id}>
              <LinhaLancamento
                lancamento={l}
                modo="atleta"
                onEditar={onEditar}
                onEstornar={onEstornar}
                onExcluir={onExcluir}
                selecao={selecao ? { marcado: selecao.marcados.has(l.id), onChange: (shift) => selecao.onMarcar(l.id, i, shift) } : undefined}
              />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
