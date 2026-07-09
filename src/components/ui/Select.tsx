"use client";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectGroup {
  label: string;
  options: SelectOption[];
}

type SelectEntry = SelectOption | SelectGroup;

function isGroup(entry: SelectEntry): entry is SelectGroup {
  return "options" in entry;
}

function parseOption(child: ReactNode): SelectOption | null {
  if (!isValidElement(child) || child.type !== "option") return null;
  const props = child.props as { value?: string; children?: ReactNode; disabled?: boolean };
  return { value: props.value ?? "", label: props.children, disabled: props.disabled };
}

function parseChildren(children: ReactNode): SelectEntry[] {
  const entries: SelectEntry[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const opt = parseOption(child);
      if (opt) entries.push(opt);
    } else if (child.type === "optgroup") {
      const props = child.props as { label?: string; children?: ReactNode };
      const options: SelectOption[] = [];
      Children.forEach(props.children, (opt) => {
        const parsed = parseOption(opt);
        if (parsed) options.push(parsed);
      });
      entries.push({ label: props.label ?? "", options });
    }
  });
  return entries;
}

function flattenOptions(entries: SelectEntry[]): SelectOption[] {
  return entries.flatMap((e) => (isGroup(e) ? e.options : [e]));
}

function textoDe(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return "";
}

function filtrarEntradas(entries: SelectEntry[], busca: string): SelectEntry[] {
  const alvo = busca.trim().toLowerCase();
  if (!alvo) return entries;
  return entries
    .map((entry) =>
      isGroup(entry)
        ? { ...entry, options: entry.options.filter((o) => textoDe(o.label).toLowerCase().includes(alvo)) }
        : entry,
    )
    .filter((entry) =>
      isGroup(entry) ? entry.options.length > 0 : textoDe(entry.label).toLowerCase().includes(alvo),
    );
}

interface SelectProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Mostra um campo de busca no topo da lista — útil quando há muitas opções. */
  searchable?: boolean;
}

export function Select({
  value,
  onChange,
  children,
  placeholder,
  disabled,
  className,
  searchable,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [busca, setBusca] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const entries = parseChildren(children);
  const flat = flattenOptions(entries);
  const selected = flat.find((o) => o.value === value);

  const entriesVisiveis = searchable ? filtrarEntradas(entries, busca) : entries;
  const flatVisivel = searchable ? flattenOptions(entriesVisiveis) : flat;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) buscaRef.current?.focus();
  }, [open, searchable]);

  function openList() {
    const idx = flat.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setBusca("");
    setOpen(true);
  }

  function selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    onChange({ target: { value: opt.value } });
    setOpen(false);
  }

  function moveHighlight(direction: 1 | -1) {
    if (flatVisivel.length === 0) return;
    setHighlighted((h) => {
      let next = h;
      for (let i = 0; i < flatVisivel.length; i++) {
        next = (next + direction + flatVisivel.length) % flatVisivel.length;
        if (!flatVisivel[next]?.disabled) break;
      }
      return next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      else moveHighlight(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      if (searchable && e.key === " ") return;
      e.preventDefault();
      if (open) {
        const opt = flatVisivel[highlighted];
        if (opt) selectOption(opt);
      } else {
        openList();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-bg-card pl-3 pr-2.5 text-sm outline-none transition-colors",
          "focus:border-primary focus:ring-2 focus:ring-primary/15",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/40",
          className,
        )}
      >
        <span className={cn("truncate text-left", selected ? "text-text" : "text-text-muted")}>
          {selected ? selected.label : (placeholder ?? "Selecione…")}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 flex max-h-72 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-bg-card shadow-lg"
        >
          {searchable && (
            <div className="shrink-0 border-b border-border p-1.5">
              <div className="flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-bg px-2">
                <Search className="size-3.5 shrink-0 text-text-muted" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setHighlighted(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar…"
                  className="h-full w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto p-1">
            {entriesVisiveis.length === 0 && (
              <p className="px-3 py-2 text-sm text-text-muted">
                {searchable ? "Nenhuma opção encontrada." : "Nenhuma opção disponível."}
              </p>
            )}
            {entriesVisiveis.map((entry, i) =>
              isGroup(entry) ? (
                <div key={`group-${i}`} className="mt-1 first:mt-0">
                  <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                    {entry.label}
                  </p>
                  {entry.options.map((opt) => (
                    <OptionRow
                      key={opt.value}
                      opt={opt}
                      active={flatVisivel.indexOf(opt) === highlighted}
                      selected={opt.value === value}
                      onSelect={() => selectOption(opt)}
                    />
                  ))}
                </div>
              ) : (
                <OptionRow
                  key={entry.value}
                  opt={entry}
                  active={flatVisivel.indexOf(entry) === highlighted}
                  selected={entry.value === value}
                  onSelect={() => selectOption(entry)}
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  opt,
  active,
  selected,
  onSelect,
}: {
  opt: SelectOption;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={opt.disabled}
      onClick={onSelect}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[calc(var(--radius)-2px)] px-2.5 py-2 text-left text-sm transition-colors",
        opt.disabled
          ? "cursor-not-allowed text-text-muted opacity-60"
          : selected
            ? "bg-primary/10 font-semibold text-primary"
            : active
              ? "bg-bg text-text"
              : "text-text hover:bg-bg",
      )}
    >
      <span className="truncate">{opt.label}</span>
      {selected && <Check className="size-3.5 shrink-0" />}
    </button>
  );
}
