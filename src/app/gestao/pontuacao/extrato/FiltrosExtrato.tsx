"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { dataIsoLocal } from "@/lib/date";
import { filtrosAtivos, FILTRO_VAZIO, type FiltroExtrato } from "@/lib/extrato";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const campo =
  "h-11 w-full rounded-[var(--radius)] border border-border bg-bg-card px-3 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";

/**
 * Busca sempre à vista; o resto dos filtros fica recolhido no celular
 * ("Filtros (2)") e aberto no computador.
 */
export function FiltrosExtrato({
  filtro,
  busca,
  onBusca,
  onChange,
  criterios,
  pessoas,
}: {
  filtro: FiltroExtrato;
  busca: string;
  onBusca: (texto: string) => void;
  onChange: (f: FiltroExtrato) => void;
  criterios: { id: string; descricao: string }[];
  pessoas: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const ativos = filtrosAtivos(filtro);
  const mudar = (parcial: Partial<FiltroExtrato>) => onChange({ ...filtro, ...parcial });
  const temAlgo = ativos > 0 || busca.trim();

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar atleta</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar atleta"
            enterKeyHint="search"
            autoComplete="off"
            className={cn(campo, "pl-9")}
          />
        </label>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius)] border border-border bg-bg-card px-3.5 text-sm font-semibold text-text transition-colors hover:bg-bg-inset md:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros{ativos ? ` (${ativos})` : ""}
        </button>
      </div>

      <div className={cn("flex-col gap-4 md:flex", aberto ? "flex" : "hidden")}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">De</span>
            <input type="date" value={filtro.de} max={filtro.ate || dataIsoLocal()} onChange={(e) => mudar({ de: e.target.value })} className={campo} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Até</span>
            <input type="date" value={filtro.ate} min={filtro.de || undefined} max={dataIsoLocal()} onChange={(e) => mudar({ ate: e.target.value })} className={campo} />
          </label>
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-xs font-semibold text-text-light">Critério</span>
            <Select value={filtro.regraId} onChange={(e) => mudar({ regraId: e.target.value })} searchable={criterios.length > 8}>
              <option value="">Todos os critérios</option>
              {criterios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.descricao}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-xs font-semibold text-text-light">Registrado por</span>
            <Select value={filtro.pessoa} onChange={(e) => mudar({ pessoa: e.target.value })} searchable={pessoas.length > 8}>
              <option value="">Qualquer pessoa</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Período pela data</span>
            <SegmentedControl
              value={filtro.campoData}
              onChange={(v) => mudar({ campoData: v })}
              options={[
                { value: "treino", label: "Do treino" },
                { value: "registro", label: "Do registro" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Situação</span>
            <SegmentedControl
              value={filtro.situacao}
              onChange={(v) => mudar({ situacao: v })}
              options={[
                { value: "todos", label: "Todos" },
                { value: "validos", label: "Válidos" },
                { value: "estornados", label: "Estornados" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Equipe</span>
            <SegmentedControl
              value={filtro.equipe}
              onChange={(v) => mudar({ equipe: v })}
              options={[
                { value: "todas", label: "Todas" },
                { value: "corrida", label: "Corrida" },
                { value: "bicicleta", label: "Bike" },
              ]}
            />
          </div>
          {temAlgo ? (
            <button
              type="button"
              onClick={() => {
                onBusca("");
                onChange(FILTRO_VAZIO);
              }}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover sm:ml-auto"
            >
              <X className="size-4" aria-hidden="true" />
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
