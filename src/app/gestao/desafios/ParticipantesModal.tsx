"use client";

import { useState } from "react";
import { CheckCircle2, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { modalidadeLabel } from "@/lib/labels";
import { participacaoNoDesafio, TIPO_DESAFIO, textoPeriodo, type DesafioDoc } from "@/lib/desafios";
import type { AtletaDoc } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { AvatarPessoa } from "@/components/atletas/AvatarAtleta";

type Filtro = "todos" | "completaram" | "faltam";

/** Quem já completou (com a data) e quanto falta para cada um dos outros. */
export function ParticipantesModal({
  desafio,
  participacao,
  hoje,
  onFechar,
}: {
  desafio: DesafioDoc | null;
  participacao: ReturnType<typeof participacaoNoDesafio<AtletaDoc>> | null;
  hoje: string;
  onFechar: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const lista = participacao?.participantes ?? [];
  const concluidos = participacao?.concluidos ?? 0;
  const visiveis = lista.filter((p) => (filtro === "todos" ? true : filtro === "completaram" ? !!p.progresso.concluidoEm : !p.progresso.concluidoEm));
  const encerrado = desafio ? hoje > desafio.fim : false;
  const unidade = desafio ? TIPO_DESAFIO[desafio.tipo] : null;

  return (
    <Modal
      open={desafio !== null}
      onClose={() => {
        setFiltro("todos");
        onFechar();
      }}
      mobileSheet
      size="md"
      title={desafio?.titulo ?? "Atletas"}
      description={desafio ? `${textoPeriodo(desafio)}. ${concluidos} de ${lista.length} completaram.` : undefined}
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl<Filtro>
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "todos", label: `Todos (${lista.length})` },
            { value: "completaram", label: `Completaram (${concluidos})` },
            { value: "faltam", label: `${encerrado ? "Não completaram" : "Faltam"} (${lista.length - concluidos})` },
          ]}
          className="w-full [&>button]:flex-1"
        />
        {visiveis.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={filtro === "completaram" ? "Ninguém completou ainda" : "Todos completaram"}
            description={filtro === "completaram" ? "Assim que alguém cumprir a meta, aparece aqui com a data." : "Todo mundo da modalidade já ganhou a medalha."}
          />
        ) : (
          <ul className="-mx-1 flex flex-col">
            {visiveis.map(({ atleta, modalidade, progresso }) => {
              const feito = !!progresso.concluidoEm;
              const pct = Math.round((progresso.atual / progresso.meta) * 100);
              return (
                <li key={atleta.id} className="flex items-center gap-3 rounded-[var(--radius)] px-1 py-2.5">
                  <AvatarPessoa pessoa={atleta} nome={atleta.nome} className="size-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-text">{atleta.nome}</p>
                      {feito ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {formatShortDate(progresso.concluidoEm!)}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs tabular-nums text-text-light">
                          {progresso.atual.toLocaleString("pt-BR")} de {progresso.meta.toLocaleString("pt-BR")} {progresso.meta === 1 ? unidade?.singular : unidade?.plural}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-inset" aria-hidden="true">
                        <div className={cn("h-full rounded-full", feito ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
                      </div>
                      {desafio?.modalidade === "todas" ? <span className="shrink-0 text-[11px] text-text-muted">{modalidadeLabel[modalidade]}</span> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
