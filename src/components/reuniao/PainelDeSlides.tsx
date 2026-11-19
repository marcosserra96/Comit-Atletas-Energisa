"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, EyeOff, GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui/Switch";

export interface SecaoDoPainel {
  id: string;
  nome: string;
  ativo: boolean;
  /** Slides que a seção gera agora (índices na apresentação). */
  slides: { indice: number; chave: string; rotulo: string }[];
}

const soNaVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function anuncios(nome: (id: string | number) => string, posicao: (id: string | number) => number) {
  return {
    onDragStart: ({ active }: { active: { id: string | number } }) => `${nome(active.id)} pego, na posição ${posicao(active.id)}. Use as setas para mover e espaço para soltar.`,
    onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => (over ? `${nome(active.id)} na posição ${posicao(over.id)}.` : undefined),
    onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => (over ? `${nome(active.id)} solto na posição ${posicao(over.id)}.` : `${nome(active.id)} solto.`),
    onDragCancel: ({ active }: { active: { id: string | number } }) => `Cancelado: ${nome(active.id)} voltou ao lugar.`,
  };
}

function Secao({
  secao,
  selecionada,
  indiceSelecionado,
  recolhida,
  onRecolher,
  onSelecionarSecao,
  onSelecionarSlide,
  onAbrir,
  onMostrar,
  miniatura,
}: {
  secao: SecaoDoPainel;
  selecionada: boolean;
  indiceSelecionado: number;
  recolhida: boolean;
  onRecolher: () => void;
  onSelecionarSecao: () => void;
  onSelecionarSlide: (indice: number) => void;
  onAbrir: (indice: number) => void;
  onMostrar: (ativo: boolean) => void;
  miniatura: (indice: number) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: secao.id });
  const varios = secao.slides.length > 1;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn("rounded-[var(--radius)]", isDragging && "relative z-10 bg-bg-card shadow-[var(--shadow-elevated)] ring-2 ring-primary/40")}>
      <div className={cn("flex items-center gap-0.5 rounded-[var(--radius-sm)] pr-1", selecionada && "bg-primary-subtle/70")}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-roledescription="item arrastável"
          aria-label={`Mudar ${secao.nome} de lugar`}
          title="Arraste para mudar de lugar"
          className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        {varios ? (
          <button type="button" onClick={onRecolher} aria-expanded={!recolhida} aria-label={`${recolhida ? "Abrir" : "Recolher"} ${secao.nome}`} className="flex size-7 shrink-0 items-center justify-center rounded text-text-muted hover:bg-bg-inset hover:text-text">
            <ChevronDown className={cn("size-3.5 transition-transform", recolhida && "-rotate-90")} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-1 shrink-0" />
        )}
        <button
          type="button"
          onClick={onSelecionarSecao}
          className={cn("flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left text-xs font-semibold hover:text-text", secao.ativo ? "text-text-secondary" : "text-text-muted line-through decoration-text-muted/50")}
        >
          <span className="truncate">{secao.nome}</span>
          {varios ? <span className="shrink-0 font-normal tabular-nums text-text-muted">{secao.slides.length}</span> : null}
        </button>
        <Switch ativo={secao.ativo} onChange={onMostrar} rotulo={`Mostrar ${secao.nome} na apresentação`} className="shrink-0 scale-75" />
      </div>
      {!secao.ativo ? (
        <button type="button" onClick={onSelecionarSecao} className="ml-7 mt-1 flex w-[calc(100%-1.75rem)] items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-border px-2 py-2 text-left text-[11px] text-text-muted hover:border-border-strong">
          <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
          Oculto na apresentação
        </button>
      ) : !recolhida ? (
        <ol className="mt-1 flex flex-col gap-2 pb-1">
          {secao.slides.map((s) => {
            const ativo = s.indice === indiceSelecionado;
            return (
              <li key={s.chave} id={`miniatura-${s.chave}`} className="flex items-start gap-1.5">
                <span className={cn("w-5 shrink-0 pt-1 text-right text-[11px] tabular-nums", ativo ? "font-bold text-primary" : "text-text-muted")}>{s.indice + 1}</span>
                <button
                  type="button"
                  onClick={() => onSelecionarSlide(s.indice)}
                  onDoubleClick={() => onAbrir(s.indice)}
                  aria-current={ativo ? "true" : undefined}
                  aria-label={`Slide ${s.indice + 1}: ${s.rotulo}`}
                  title={s.rotulo}
                  className={cn(
                    "block min-w-0 flex-1 overflow-hidden rounded-[6px] border-2 bg-bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    ativo ? "border-primary" : "border-transparent shadow-sm ring-1 ring-border hover:ring-border-strong",
                  )}
                >
                  {miniatura(s.indice)}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </li>
  );
}

/**
 * Painel de slides à esquerda, como no PowerPoint: seções do roteiro (que se
 * arrastam, recolhem e escondem) e, dentro delas, as miniaturas numeradas.
 */
export function PainelDeSlides({
  secoes,
  secaoSelecionada,
  indiceSelecionado,
  miniatura,
  onSelecionarSecao,
  onSelecionarSlide,
  onAbrir,
  onMostrar,
  onMover,
}: {
  secoes: SecaoDoPainel[];
  secaoSelecionada: string | null;
  indiceSelecionado: number;
  miniatura: (indice: number) => ReactNode;
  onSelecionarSecao: (id: string) => void;
  onSelecionarSlide: (indice: number) => void;
  /** Duplo clique: abre o slide para editar. */
  onAbrir: (indice: number) => void;
  onMostrar: (id: string, ativo: boolean) => void;
  onMover: (de: number, para: number) => void;
}) {
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = secoes.map((s) => s.id);
  const nomeDe = (id: string | number) => secoes.find((s) => s.id === id)?.nome ?? "Seção";
  const posicaoDe = (id: string | number) => ids.indexOf(String(id)) + 1;
  function soltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMover(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  }
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[soNaVertical]}
      onDragEnd={soltar}
      accessibility={{
        announcements: anuncios(nomeDe, posicaoDe),
        screenReaderInstructions: { draggable: "Para mudar de lugar, aperte espaço, use as setas para cima e para baixo e aperte espaço de novo para soltar. Esc cancela." },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2" aria-label="Slides da apresentação">
          {secoes.map((s) => (
            <Secao
              key={s.id}
              secao={s}
              selecionada={s.id === secaoSelecionada}
              indiceSelecionado={indiceSelecionado}
              recolhida={recolhidas.has(s.id)}
              onRecolher={() =>
                setRecolhidas((r) => {
                  const n = new Set(r);
                  if (n.has(s.id)) n.delete(s.id);
                  else n.add(s.id);
                  return n;
                })
              }
              onSelecionarSecao={() => onSelecionarSecao(s.id)}
              onSelecionarSlide={onSelecionarSlide}
              onAbrir={onAbrir}
              onMostrar={(ativo) => onMostrar(s.id, ativo)}
              miniatura={miniatura}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
