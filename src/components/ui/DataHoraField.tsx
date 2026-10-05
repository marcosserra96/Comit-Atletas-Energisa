"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

const DATA_OK = /^(19|20)\d{2}-\d{2}-\d{2}$/;
const HORA_OK = /^\d{2}:\d{2}$/;

function partes(iso: string) {
  if (!iso) return { data: "", hora: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { data: "", hora: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/** Data + hora locais → ISO. Vazio quando ainda está incompleto ou inválido. */
export function montarIso(data: string, hora: string) {
  if (!DATA_OK.test(data) || !HORA_OK.test(hora)) return "";
  const d = new Date(`${data}T${hora}`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const campo =
  "h-11 w-full min-w-0 rounded-[var(--radius)] border border-border bg-bg px-3 text-base text-text outline-none transition-colors focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15 sm:text-sm";

/**
 * Data e hora em dois campos nativos (calendário e relógio do aparelho).
 * O que a pessoa digita fica num rascunho local: o valor só sobe quando a data
 * e a hora estão completas, então o campo nunca "pula" nem apaga no meio da
 * digitação, e um valor incompleto vira uma mensagem clara.
 */
export function DataHoraField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  /** ISO 8601 ou "" */
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [rascunho, setRascunho] = useState(() => partes(value));
  const [origem, setOrigem] = useState(value);
  const [tocado, setTocado] = useState(false);

  // Valor mudou por fora (ex.: "Descartar"): recomeça o rascunho.
  if (value !== origem) {
    setOrigem(value);
    if (value !== montarIso(rascunho.data, rascunho.hora)) setRascunho(partes(value));
  }

  function alterar(proximo: { data: string; hora: string }) {
    setRascunho(proximo);
    const iso = montarIso(proximo.data, proximo.hora);
    if (iso && iso !== value) {
      setOrigem(iso);
      onChange(iso);
    }
  }

  const incompleto = tocado && !montarIso(rascunho.data, rascunho.hora);
  const mensagem = error || (incompleto ? "Preencha a data e a hora completas." : "");
  const idMensagem = `${id}-msg`;

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" onBlur={(e) => {
        // Só avisa quando o foco sai dos dois campos (não ao passar da data para a hora).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTocado(true);
      }}>
      <legend className="mb-1.5 text-sm font-medium text-text">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <input
          type="date"
          aria-label={`${label}: data`}
          value={rascunho.data}
          min="2020-01-01"
          max="2099-12-31"
          onChange={(e) => alterar({ ...rascunho, data: e.target.value })}
          aria-invalid={mensagem ? true : undefined}
          aria-describedby={mensagem ? idMensagem : undefined}
          className={cn(campo, mensagem && "border-danger")}
        />
        <input
          type="time"
          aria-label={`${label}: hora`}
          value={rascunho.hora}
          onChange={(e) => alterar({ ...rascunho, hora: e.target.value })}
          aria-invalid={mensagem ? true : undefined}
          aria-describedby={mensagem ? idMensagem : undefined}
          className={cn(campo, mensagem && "border-danger")}
        />
      </div>
      {mensagem ? (
        <span id={idMensagem} role="alert" className="text-xs font-medium text-danger">
          {mensagem}
        </span>
      ) : hint ? (
        <span className="text-xs text-text-muted">{hint}</span>
      ) : null}
    </fieldset>
  );
}
