"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { History, Loader2, MapPin, MapPinned } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiAutenticada } from "@/lib/apiCliente";
import { linkDoMapa, locaisUsados, semRepetidos, type Coordenadas, type SugestaoLocal } from "@/lib/locais";
import { TextField } from "@/components/ui/TextField";

const ESPERA_MS = 300;

/**
 * Campo "Local" que sugere enquanto digita: primeiro os locais que o comitê já
 * usou, depois lugares do mapa. Escolher uma sugestão guarda também a posição
 * no mapa (o "Ver mapa" do atleta abre no ponto exato). Digitar livre continua valendo.
 */
export function CampoLocal({
  valor,
  coordenadas,
  onChange,
  eventosAnteriores,
  label = "Local",
  placeholder,
  error,
}: {
  valor: string;
  coordenadas: Coordenadas | null;
  onChange: (valor: string, coordenadas: Coordenadas | null) => void;
  eventosAnteriores: readonly { local?: string; online?: boolean; coordenadas?: Coordenadas | null }[];
  label?: string;
  placeholder?: string;
  error?: string;
}) {
  const idLista = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [doMapa, setDoMapa] = useState<{ termo: string; itens: SugestaoLocal[] } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const termo = valor.trim();
  const usados = useMemo(() => locaisUsados(eventosAnteriores, termo), [eventosAnteriores, termo]);

  // Busca no mapa com uma pequena espera, para não consultar a cada letra.
  useEffect(() => {
    if (!aberto || termo.length < 3 || doMapa?.termo === termo) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const { sugestoes } = await apiAutenticada<{ sugestoes: SugestaoLocal[] }>(`/api/locais?q=${encodeURIComponent(termo)}`);
        if (vivo) setDoMapa({ termo, itens: sugestoes });
      } catch {
        if (vivo) setDoMapa({ termo, itens: [] });
      } finally {
        if (vivo) setBuscando(false);
      }
    }, ESPERA_MS);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aberto, termo, doMapa?.termo]);

  const mapaAtual = termo.length >= 3 && doMapa?.termo === termo ? doMapa.itens : [];
  const sugestoes = semRepetidos([...usados, ...mapaAtual]);
  const qtdUsados = sugestoes.filter((s) => s.origem === "usado").length;
  const esperandoMapa = termo.length >= 3 && (buscando || doMapa?.termo !== termo);
  const mostrarLista = aberto && (sugestoes.length > 0 || esperandoMapa || termo.length >= 3);

  // Fecha ao tocar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [aberto]);

  function escolher(s: SugestaoLocal) {
    onChange(s.valor, s.coordenadas ?? null);
    setAberto(false);
    setAtivo(-1);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(sugestoes.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter" && mostrarLista && ativo >= 0 && sugestoes[ativo]) {
      e.preventDefault();
      escolher(sugestoes[ativo]);
    } else if (e.key === "Escape" && mostrarLista) {
      // Fecha só a lista; a janela do evento continua aberta.
      e.preventDefault();
      setAberto(false);
    }
  }

  const idOpcao = (i: number) => `${idLista}-op-${i}`;

  return (
    <div ref={caixa} className="relative">
      <TextField
        label={label}
        icon={<MapPin className="size-[18px]" />}
        placeholder={placeholder}
        value={valor}
        error={error}
        required
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-activedescendant={mostrarLista && ativo >= 0 ? idOpcao(ativo) : undefined}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        onChange={(e) => {
          // Digitou por conta própria: a posição no mapa de antes não vale mais.
          onChange(e.target.value, null);
          setAberto(true);
          setAtivo(-1);
        }}
      />

      {coordenadas && !mostrarLista ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-light">
          <MapPinned className="size-3.5 text-success" aria-hidden="true" />
          Local marcado no mapa.
          <a href={linkDoMapa({ local: valor, coordenadas })} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
            Conferir
          </a>
        </p>
      ) : null}

      {mostrarLista ? (
        <div
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-[var(--radius)] border border-border bg-bg-card py-1.5 shadow-[var(--shadow-elevated)]"
          // Tocar na lista não tira o foco do campo antes de escolher.
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul id={idLista} role="listbox" aria-label="Sugestões de local">
            {sugestoes.map((s, i) => (
              <li key={`${s.origem}-${s.valor}`} role="presentation">
                {i === 0 && qtdUsados > 0 ? <p className="px-3.5 pb-1 pt-1 text-xs font-semibold text-text-muted">Usados antes</p> : null}
                {i === qtdUsados && i < sugestoes.length ? (
                  <p className={cn("px-3.5 pb-1 pt-1 text-xs font-semibold text-text-muted", i > 0 && "mt-1 border-t border-border-subtle pt-2")}>No mapa</p>
                ) : null}
                <button
                  type="button"
                  id={idOpcao(i)}
                  role="option"
                  aria-selected={ativo === i}
                  onClick={() => escolher(s)}
                  onMouseEnter={() => setAtivo(i)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors",
                    ativo === i ? "bg-primary-subtle" : "hover:bg-bg-subtle",
                  )}
                >
                  {s.origem === "usado" ? (
                    <History className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  ) : (
                    <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{s.titulo}</span>
                    {s.detalhe ? <span className="block truncate text-xs text-text-light">{s.detalhe}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {esperandoMapa ? (
            <p className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-text-light" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Procurando no mapa…
            </p>
          ) : termo.length >= 3 && mapaAtual.length === 0 ? (
            <p className="px-3.5 py-2.5 text-xs text-text-light" role="status">
              Nada encontrado no mapa. Pode deixar como escreveu.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
