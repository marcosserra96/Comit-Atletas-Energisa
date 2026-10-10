"use client";

import { useState } from "react";
import { ChevronDown, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPontos, plural } from "@/lib/format";
import { tipoLancamentoLabel } from "@/lib/labels";
import { dataCurta, momentoDoRegistro, type LoteExtrato } from "@/lib/extrato";
import { Badge } from "@/components/ui/Badge";
import { MenuAcoes, type AcaoDoMenu } from "@/components/ui/MenuAcoes";
import { LinhaLancamento } from "./LinhaLancamento";
import type { HistoricoPontoDoc } from "@/lib/types";

/**
 * Um lançamento (o "Salvar" do Lançar pontos) numa linha só: o que foi, quando,
 * quantos atletas e quantos pontos. Tocar abre os atletas.
 */
export function LoteCard({
  lote,
  podeExcluir,
  onEditarLote,
  onEstornarLote,
  onExcluirLote,
  onEditar,
  onEstornar,
  onExcluir,
}: {
  lote: LoteExtrato;
  podeExcluir: boolean;
  onEditarLote: (lote: LoteExtrato) => void;
  onEstornarLote: (lote: LoteExtrato) => void;
  onExcluirLote: (lote: LoteExtrato) => void;
  onEditar: (l: HistoricoPontoDoc) => void;
  onEstornar: (l: HistoricoPontoDoc) => void;
  onExcluir: (l: HistoricoPontoDoc) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const validos = lote.itens.filter((l) => !l.estornado);
  const tudoEstornado = validos.length === 0;
  const acoes: AcaoDoMenu[] = [
    ...(!tudoEstornado ? [{ rotulo: "Editar lançamento", icone: Pencil, onSelect: () => onEditarLote(lote) }] : []),
    ...(!tudoEstornado
      ? [{ rotulo: validos.length === 1 ? "Estornar" : `Estornar os ${validos.length}`, icone: RotateCcw, onSelect: () => onEstornarLote(lote), perigo: true }]
      : []),
    ...(podeExcluir ? [{ rotulo: "Excluir de vez", icone: Trash2, onSelect: () => onExcluirLote(lote), perigo: true }] : []),
  ];
  const datas = lote.datas.map((d) => dataCurta(d)).join(", ");
  const regras = [...new Set(lote.itens.map((l) => l.regraDesc))];
  // O que todos têm em comum vai no cabeçalho; a linha mostra só o que for diferente.
  const contexto = {
    regraDesc: regras.length === 1 ? regras[0] : undefined,
    data: lote.datas.length === 1 ? lote.datas[0] : undefined,
    todoEstornado: tudoEstornado,
  };

  return (
    <li className="rounded-[var(--radius-lg)] border border-border bg-bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-l-[var(--radius-lg)] px-4 py-3 text-left transition-colors hover:bg-bg-inset/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <ChevronDown className={cn("size-4 shrink-0 text-text-muted transition-transform duration-200", aberto && "rotate-180")} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("truncate font-semibold text-text", tudoEstornado && "text-text-muted line-through")}>{lote.titulo}</span>
              <Badge tone="neutral" className="hidden shrink-0 sm:inline-flex">{tipoLancamentoLabel[lote.tipo] ?? lote.tipo}</Badge>
            </span>
            <span className="block truncate text-xs text-text-light">
              {datas} · {lote.atletas === 1 ? lote.itens[0].atletaNome : plural(lote.atletas, "atleta")}
              {regras.length === 1 && regras[0] !== lote.titulo ? ` · ${regras[0]}` : ""} · {lote.criadoPorNome.split(" ")[0]}, {momentoDoRegistro({ criadoEm: lote.criadoEmMs })}
              {lote.editado ? " · editado" : ""}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className={cn("text-base font-bold tabular-nums", tudoEstornado ? "text-text-muted line-through" : "text-success")}>
              +{formatPontos(tudoEstornado ? lote.itens.reduce((s, l) => s + l.pontos, 0) : lote.pontosValidos)}
            </span>
            {lote.estornados > 0 ? (
              <span className="text-xs font-semibold text-danger">{tudoEstornado ? "estornado" : `${lote.estornados} estornado${lote.estornados > 1 ? "s" : ""}`}</span>
            ) : null}
          </span>
        </button>
        <MenuAcoes acoes={acoes} rotulo={`Ações do lançamento ${lote.titulo}`} />
      </div>
      {aberto ? (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle px-4">
          {lote.itens.map((l) => (
            <li key={l.id}>
              <LinhaLancamento lancamento={l} modo="lote" contexto={contexto} onEditar={onEditar} onEstornar={onEstornar} onExcluir={podeExcluir ? onExcluir : undefined} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
