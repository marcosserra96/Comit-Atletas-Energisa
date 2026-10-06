"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { equipeLabel } from "@/lib/labels";
import { buscaCombina, sugerirPorNome } from "@/lib/semelhancaNome";
import type { AtletaDoc } from "@/lib/types";

/**
 * Escolher o cadastro para vincular a um login: sugestões pelo nome (e e-mail)
 * de quem pediu, busca sem acento e a lista completa em ordem alfabética.
 */
export function SeletorDeCadastro({
  atletas,
  valor,
  onChange,
  referencia,
}: {
  atletas: AtletaDoc[];
  valor: string;
  onChange: (id: string) => void;
  /** Nome e e-mail de quem pediu acesso, para as sugestões. */
  referencia: { nome: string; email?: string | null };
}) {
  const idBusca = useId();
  const [busca, setBusca] = useState("");

  const ordenados = useMemo(
    () => [...atletas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [atletas],
  );
  const { nome: nomeRef, email: emailRef } = referencia;
  const sugestoes = useMemo(
    () => sugerirPorNome({ nome: nomeRef, email: emailRef }, ordenados, (a) => a.nome),
    [nomeRef, emailRef, ordenados],
  );
  const filtrados = busca.trim() ? ordenados.filter((a) => buscaCombina(busca, a.nome)) : ordenados;
  const idsSugeridos = new Set(sugestoes.map((s) => s.item.id));

  // Função de render (não componente): não remonta os botões a cada digitação.
  function linha(atleta: AtletaDoc, sugerido = false) {
    const ativo = atleta.id === valor;
    return (
      <li key={atleta.id}>
        <button
          type="button"
          role="option"
          aria-selected={ativo}
          onClick={() => onChange(atleta.id)}
          className={cn(
            "flex w-full min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            ativo ? "bg-primary-subtle text-text ring-1 ring-primary/40" : "hover:bg-bg-inset",
          )}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              ativo ? "border-primary bg-primary text-on-primary" : "border-border",
            )}
            aria-hidden="true"
          >
            {ativo ? <Check className="size-3.5" /> : null}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-text">{atleta.nome}</span>
          {sugerido ? (
            <span className="hidden shrink-0 text-xs font-semibold text-primary sm:inline">nome parecido</span>
          ) : null}
          <span className="shrink-0 text-xs text-text-light">{equipeLabel[atleta.equipe] ?? atleta.equipe}</span>
        </button>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sugestoes.length > 0 && !busca.trim() ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {sugestoes.length === 1 ? "Sugestão pelo nome" : "Sugestões pelo nome"}
          </p>
          <ul className="flex flex-col gap-1" role="listbox" aria-label="Sugestões pelo nome">
            {sugestoes.map((s) => linha(s.item, true))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={idBusca} className="text-xs font-bold uppercase tracking-wide text-text-muted">
          {sugestoes.length > 0 ? "Não é nenhum desses? Procure" : "Procure o cadastro"}
        </label>
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-3 focus-within:border-primary focus-within:bg-bg-card focus-within:ring-2 focus-within:ring-primary/15">
          <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            id={idBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Nome do atleta (${atletas.length} sem login)`}
            autoComplete="off"
            className="h-10 w-full bg-transparent text-base text-text outline-none placeholder:text-text-muted sm:text-sm"
          />
        </div>
        <ul
          className="flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius)] border border-border p-1"
          role="listbox"
          aria-label="Cadastros sem login, em ordem alfabética"
        >
          {filtrados.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-text-light">Nenhum cadastro com esse nome. Talvez seja o caso de criar um novo perfil.</li>
          ) : (
            filtrados.map((a) => linha(a, idsSugeridos.has(a.id) && !!busca.trim()))
          )}
        </ul>
      </div>
    </div>
  );
}
