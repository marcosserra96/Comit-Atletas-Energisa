"use client";

import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatKm, formatPontos } from "@/lib/format";
import { camposEditaveis, dataCurta, type LancamentoComEdicao } from "@/lib/extrato";
import { AvatarPessoa } from "@/components/atletas/AvatarAtleta";
import { Badge } from "@/components/ui/Badge";
import { MenuAcoes, type AcaoDoMenu } from "@/components/ui/MenuAcoes";
import type { HistoricoPontoDoc } from "@/lib/types";

/**
 * Uma linha de lançamento: quem (ou o critério, na ficha), o que, quando e os
 * pontos à direita. Ações num menu "⋯" para não competir com os dados.
 */
export function LinhaLancamento({
  lancamento,
  modo,
  onEditar,
  onEstornar,
  onExcluir,
  selecao,
  contexto,
}: {
  lancamento: HistoricoPontoDoc;
  /** "lote": dentro de um lançamento (mostra o atleta); "atleta": lista solta (atleta + lançamento); "ficha": do próprio atleta. */
  modo: "lote" | "atleta" | "ficha";
  onEditar?: (l: HistoricoPontoDoc) => void;
  onEstornar?: (l: HistoricoPontoDoc) => void;
  onExcluir?: (l: HistoricoPontoDoc) => void;
  selecao?: { marcado: boolean; onChange: (shift: boolean) => void };
  /** Dentro de um lançamento: critério e data iguais aos do cabeçalho não se repetem em cada linha. */
  contexto?: { regraDesc?: string; data?: string; todoEstornado?: boolean };
}) {
  const l = lancamento as LancamentoComEdicao;
  const ultimaEdicao = l.edicoes?.[l.edicoes.length - 1];
  const editavel = camposEditaveis(l).observacao;
  const acoes: AcaoDoMenu[] = [
    ...(onEditar && editavel ? [{ rotulo: "Editar", icone: Pencil, onSelect: () => onEditar(l) }] : []),
    ...(onEstornar && !l.estornado ? [{ rotulo: "Estornar", icone: RotateCcw, onSelect: () => onEstornar(l), perigo: true }] : []),
    ...(onExcluir ? [{ rotulo: "Excluir de vez", icone: Trash2, onSelect: () => onExcluir(l), perigo: true }] : []),
  ];
  const titulo = modo === "ficha" ? l.regraDesc : l.atletaNome;
  const detalhes = [
    modo !== "ficha" && l.regraDesc !== contexto?.regraDesc ? l.regraDesc : null,
    modo === "atleta" && l.descricaoLote ? l.descricaoLote : null,
    l.dataTreino === contexto?.data ? null : l.dataAproximada ? `${dataCurta(l.dataTreino)} (aprox.)` : dataCurta(l.dataTreino),
    l.kmPercorrido ? formatKm(l.kmPercorrido) : null,
  ].filter(Boolean);

  return (
    <div className={cn("flex items-start gap-3 py-2.5", l.estornado && "opacity-75")}>
      {selecao ? (
        <input
          type="checkbox"
          checked={selecao.marcado}
          onChange={(e) => selecao.onChange((e.nativeEvent as MouseEvent).shiftKey)}
          aria-label={`Selecionar lançamento de ${l.atletaNome}`}
          title="Segure Shift para marcar um intervalo"
          className="mt-2.5 size-4 shrink-0 rounded border-border accent-danger"
        />
      ) : null}
      {modo !== "ficha" ? (
        <AvatarPessoa pessoa={{ id: l.atletaId, porId: true }} nome={l.atletaNome} className="mt-0.5 size-9 text-xs" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold text-text", l.estornado && "line-through decoration-text-muted")}>{titulo}</p>
        {detalhes.length ? <p className="truncate text-xs text-text-light">{detalhes.join(" · ")}</p> : null}
        {l.observacao ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-text-muted">{l.observacao}</p> : null}
        <div className="flex flex-col items-start gap-0.5 empty:hidden">
          {l.justificativaAusenciaId ? <Badge tone="primary" className="mt-1.5">Solicitada pelo atleta</Badge> : null}
          {l.estornado && l.motivoEstorno ? <span className="mt-1 text-xs text-text-muted">Estornado: {l.motivoEstorno}</span> : null}
          {ultimaEdicao ? (
            <span className="mt-1 text-xs text-text-muted" title={l.edicoes!.map((e) => `${e.porNome}: ${e.resumo}`).join("\n")}>
              Editado por {ultimaEdicao.porNome.split(" ")[0]} · {ultimaEdicao.resumo}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        <span className={cn("text-sm font-bold tabular-nums", l.estornado ? "text-text-muted line-through" : l.pontos > 0 ? "text-success" : "text-text-light")}>
          {l.pontos > 0 ? "+" : ""}
          {formatPontos(l.pontos)}
        </span>
        {l.estornado && !contexto?.todoEstornado ? <Badge tone="danger">Estornado</Badge> : null}
      </div>
      {acoes.length ? (
        <MenuAcoes acoes={acoes} rotulo={`Ações do lançamento de ${l.atletaNome}`} className="-my-0.5" />
      ) : (
        // Sem ações (ex.: estornado), guarda o espaço do "⋯" para os pontos ficarem alinhados.
        <span className="size-9 shrink-0 pointer-coarse:size-11" aria-hidden="true" />
      )}
    </div>
  );
}
