"use client";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
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

interface SelectProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({ value, onChange, children, placeholder, disabled, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const entries = parseChildren(children);
  const flat = flattenOptions(entries);
  const selected = flat.find((o) => o.value === value);

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

  function openList() {
    const idx = flat.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    onChange({ target: { value: opt.value } });
    setOpen(false);
  }

  function moveHighlight(direction: 1 | -1) {
    if (flat.length === 0) return;
    setHighlighted((h) => {
      let next = h;
      for (let i = 0; i < flat.length; i++) {
        next = (next + direction + flat.length) % flat.length;
        if (!flat[next]?.disabled) break;
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
      e.preventDefault();
      if (open) {
        const opt = flat[highlighted];
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
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-[var(--radius)] border border-border bg-bg-card p-1 shadow-lg"
        >
          {entries.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-muted">Nenhuma opção disponível.</p>
          )}
          {entries.map((entry, i) =>
            isGroup(entry) ? (
              <div key={`group-${i}`} className="mt-1 first:mt-0">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                  {entry.label}
                </p>
                {entry.options.map((opt) => (
                  <OptionRow
                    key={opt.value}
                    opt={opt}
                    active={flat.indexOf(opt) === highlighted}
                    selected={opt.value === value}
                    onSelect={() => selectOption(opt)}
                  />
                ))}
              </div>
            ) : (
              <OptionRow
                key={entry.value}
                opt={entry}
                active={flat.indexOf(entry) === highlighted}
                selected={entry.value === value}
                onSelect={() => selectOption(entry)}
              />
            ),
          )}
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
