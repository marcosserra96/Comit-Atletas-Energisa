"use client";

import { useId, useMemo, useState } from "react";
import { BellOff, BellRing, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { equipeLabel } from "@/lib/labels";
import { buscaCombina } from "@/lib/semelhancaNome";
import { LIMITE_SELECIONADOS } from "@/lib/push/regras";
import type { PessoaPush } from "@/lib/push/comite";
import type { Equipe } from "@/lib/types";
import { AvatarPessoa } from "@/components/atletas/AvatarAtleta";

type Filtro = "todos" | "corrida" | "bicicleta" | "comite";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "corrida", label: "Corrida" },
  { value: "bicicleta", label: "Bike" },
  { value: "comite", label: "Comitê" },
];

/**
 * Escolher quem recebe: busca sem acento, filtro por equipe e quem não ativou
 * as notificações aparece desativado (não tem como receber).
 */
export function SeletorDePessoas({
  pessoas,
  erro,
  selecionados,
  onChange,
}: {
  /** `null` carregando. */
  pessoas: PessoaPush[] | null;
  erro?: string;
  selecionados: Set<string>;
  onChange: (ids: Set<string>) => void;
}) {
  const idBusca = useId();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visiveis = useMemo(
    () =>
      (pessoas ?? []).filter(
        (p) => (filtro === "todos" || p.equipe === filtro) && (!busca.trim() || buscaCombina(busca, p.nome)),
      ),
    [pessoas, filtro, busca],
  );
  const podemReceber = visiveis.filter((p) => p.aparelhos > 0);
  const todosMarcados = podemReceber.length > 0 && podemReceber.every((p) => selecionados.has(p.id));
  const escolhidos = (pessoas ?? []).filter((p) => selecionados.has(p.id));

  function alternar(id: string) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else if (novo.size < LIMITE_SELECIONADOS) novo.add(id);
    onChange(novo);
  }

  function marcarVisiveis() {
    const novo = new Set(selecionados);
    if (todosMarcados) podemReceber.forEach((p) => novo.delete(p.id));
    else podemReceber.slice(0, LIMITE_SELECIONADOS - novo.size).forEach((p) => novo.add(p.id));
    onChange(novo);
  }

  if (erro) return <p className="rounded-[var(--radius)] bg-bg-inset p-3 text-sm text-danger">{erro}</p>;
  if (pessoas === null) return <div className="h-64 animate-pulse rounded-[var(--radius)] bg-bg-inset" aria-hidden="true" />;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border p-3">
      {escolhidos.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Escolhidos">
          {escolhidos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => alternar(p.id)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary-subtle py-1 pl-1 pr-2 text-xs font-semibold text-text transition-colors hover:bg-primary/15"
              aria-label={`Tirar ${p.nome}`}
            >
              <AvatarPessoa pessoa={{ id: p.id, porId: true }} nome={p.nome} className="size-6 text-[9px]" />
              {p.nome}
              <X className="size-3.5 text-text-muted" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="min-h-8 px-2 text-xs font-semibold text-text-light hover:text-text hover:underline"
          >
            Limpar
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-light">Ninguém escolhido ainda. Marque uma ou mais pessoas na lista.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-3 focus-within:border-primary focus-within:bg-bg-card focus-within:ring-2 focus-within:ring-primary/15">
          <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <label htmlFor={idBusca} className="sr-only">
            Buscar pessoa
          </label>
          <input
            id={idBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome"
            autoComplete="off"
            className="h-10 w-full bg-transparent text-base text-text outline-none placeholder:text-text-muted sm:text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filtrar por equipe">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filtro === f.value}
              onClick={() => setFiltro(f.value)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors",
                filtro === f.value ? "bg-navy text-white" : "bg-bg-inset text-text-light hover:text-text",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-1 text-xs text-text-light">
        <span>
          {visiveis.length} na lista · {podemReceber.length} com notificações ativas
        </span>
        {podemReceber.length > 0 ? (
          <button type="button" onClick={marcarVisiveis} className="font-semibold text-primary hover:underline">
            {todosMarcados ? "Desmarcar estes" : "Marcar todos estes"}
          </button>
        ) : null}
      </div>

      <ul className="-mx-1 flex max-h-72 flex-col overflow-y-auto" aria-label="Pessoas">
        {visiveis.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-text-light">Ninguém com esse nome.</li>
        ) : (
          visiveis.map((p) => {
            const recebe = p.aparelhos > 0;
            const marcado = selecionados.has(p.id);
            return (
              <li key={p.id}>
                <label
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors",
                    recebe ? "cursor-pointer hover:bg-bg-inset" : "cursor-not-allowed",
                    marcado && "bg-primary-subtle",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={marcado}
                    disabled={!recebe}
                    onChange={() => alternar(p.id)}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-[6px] border",
                      marcado ? "border-primary bg-primary text-on-primary" : "border-border bg-bg-card",
                      !recebe && "opacity-40",
                    )}
                  >
                    {marcado ? <Check className="size-3.5" /> : null}
                  </span>
                  <AvatarPessoa pessoa={{ id: p.id, porId: true }} nome={p.nome} className={cn("size-8 text-xs", !recebe && "opacity-50")} />
                  <span className={cn("min-w-0 flex-1 truncate font-medium", recebe ? "text-text" : "text-text-muted")}>
                    {p.nome}
                  </span>
                  <span className="hidden shrink-0 text-xs text-text-light sm:inline">
                    {equipeLabel[p.equipe as Equipe] ?? p.equipe}
                  </span>
                  {recebe ? (
                    <BellRing className="size-4 shrink-0 text-success" aria-label="Notificações ativas" />
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
                      <BellOff className="size-3.5" aria-hidden="true" />
                      não ativou
                    </span>
                  )}
                </label>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
