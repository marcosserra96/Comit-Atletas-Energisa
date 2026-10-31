"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Pencil, Target } from "lucide-react";
import { apiAutenticada } from "@/lib/apiCliente";
import { cn } from "@/lib/cn";
import {
  LIMITES_META,
  progressoDaMeta,
  sugestoesDeMeta,
  type MetaPessoal,
  type MetasPessoais,
  type TipoMetaPessoal,
} from "@/lib/metaPessoal";
import type { Modalidade } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";

/**
 * Meta pessoal do mês, dentro de "Seu mês" no Início: o atleta escolhe km ou
 * treinos e acompanha a barra. Na visualização como atleta, só leitura.
 */
export function MetaDoMes({
  atletaId,
  hoje,
  nomeDoMes,
  realizado,
  mesPassado,
  modalidade,
  somenteLeitura,
}: {
  atletaId: string;
  hoje: string;
  /** "novembro" */
  nomeDoMes: string;
  realizado: { km: number; treinos: number };
  mesPassado: { km: number; treinos: number };
  modalidade: Modalidade;
  somenteLeitura?: boolean;
}) {
  const competencia = hoje.slice(0, 7);
  const [meta, setMeta] = useState<MetaPessoal | null | undefined>(undefined);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let ativo = true;
    apiAutenticada<{ metas: MetasPessoais }>(`/api/meta-pessoal${somenteLeitura ? `?atletaId=${encodeURIComponent(atletaId)}` : ""}`)
      .then((r) => ativo && setMeta(r.metas[competencia] ?? null))
      .catch(() => ativo && setMeta(null));
    return () => {
      ativo = false;
    };
  }, [atletaId, competencia, somenteLeitura]);

  if (meta === undefined) return <div className="mt-3 h-14 animate-pulse rounded-[var(--radius)] bg-bg-inset" />;

  if (editando) {
    return (
      <EditorDaMeta
        inicial={meta}
        competencia={competencia}
        nomeDoMes={nomeDoMes}
        mesPassado={mesPassado}
        modalidade={modalidade}
        onSalvo={(m) => {
          setMeta(m);
          setEditando(false);
        }}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  if (!meta) {
    if (somenteLeitura) return null;
    return (
      <div className="mt-3 flex items-center gap-3 rounded-[var(--radius)] border border-dashed border-border px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Target className="size-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-text-light">
          <span className="font-semibold text-text">Defina sua meta de {nomeDoMes}.</span> Uma meta só sua, em km ou treinos, para acompanhar aqui.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
          Definir
        </Button>
      </div>
    );
  }

  const p = progressoDaMeta(meta, realizado, hoje);
  return (
    <div className="mt-3 px-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-text">
          <Target className="size-4 text-primary" aria-hidden="true" />
          Minha meta
        </span>
        <span className="flex items-center gap-1 font-bold tabular-nums text-text">
          {p.resumo}
          {somenteLeitura ? null : (
            <button
              type="button"
              onClick={() => setEditando(true)}
              aria-label="Alterar minha meta"
              className="ml-1 flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:size-10"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-bg-inset"
        role="progressbar"
        aria-label="Progresso da minha meta"
        aria-valuemin={0}
        aria-valuemax={p.meta}
        aria-valuenow={p.atual}
      >
        <motion.div
          className={cn("h-full origin-left rounded-full", p.concluida ? "bg-success" : "bg-primary")}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: p.fracao }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
      <p className={cn("mt-1 flex items-center gap-1 text-xs", p.concluida ? "font-semibold text-success" : "text-text-light")}>
        {p.concluida ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}
        {p.situacao}
      </p>
    </div>
  );
}

function EditorDaMeta({
  inicial,
  competencia,
  nomeDoMes,
  mesPassado,
  modalidade,
  onSalvo,
  onCancelar,
}: {
  inicial: MetaPessoal | null;
  competencia: string;
  nomeDoMes: string;
  mesPassado: { km: number; treinos: number };
  modalidade: Modalidade;
  onSalvo: (meta: MetaPessoal | null) => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMetaPessoal>(inicial?.tipo ?? "km");
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : "");
  const [salvando, setSalvando] = useState<"salvar" | "remover" | null>(null);
  const [erro, setErro] = useState("");
  const idSugestoes = useId();
  const sugestoes = sugestoesDeMeta(tipo, mesPassado, modalidade);
  const temHistorico = tipo === "km" ? mesPassado.km >= 1 : mesPassado.treinos > 0;

  async function salvar(remover = false) {
    setErro("");
    setSalvando(remover ? "remover" : "salvar");
    try {
      await apiAutenticada("/api/meta-pessoal", {
        method: "POST",
        body: JSON.stringify(remover ? { competencia, remover: true } : { competencia, tipo, valor: Number(valor) }),
      });
      onSalvo(remover ? null : { tipo, valor: Number(valor) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar agora.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-bg-inset/40 p-3">
      <p className="text-sm font-semibold text-text">Minha meta de {nomeDoMes}</p>
      <SegmentedControl
        value={tipo}
        onChange={(t) => {
          setTipo(t);
          setValor("");
          setErro("");
        }}
        options={[
          { value: "km", label: "Quilômetros" },
          { value: "treinos", label: "Treinos" },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <span id={idSugestoes} className="text-xs text-text-light">
          {temHistorico
            ? `No mês passado: ${tipo === "km" ? `${Math.floor(mesPassado.km).toLocaleString("pt-BR")} km` : `${mesPassado.treinos} ${mesPassado.treinos === 1 ? "treino" : "treinos"}`}. Sugestões:`
            : "Sugestões para começar:"}
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={idSugestoes}>
          {sugestoes.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={valor === String(n)}
              onClick={() => {
                setValor(String(n));
                setErro("");
              }}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:min-h-11",
                valor === String(n) ? "border-primary bg-primary-subtle text-primary" : "border-border text-text-light hover:text-text",
              )}
            >
              {n.toLocaleString("pt-BR")} {tipo === "km" ? "km" : n === 1 ? "treino" : "treinos"}
            </button>
          ))}
        </div>
      </div>
      <div className="w-40">
        <TextField
          label={tipo === "km" ? "Ou digite (km)" : "Ou digite (treinos)"}
          inputMode="numeric"
          value={valor}
          className="tabular-nums"
          onChange={(e) => {
            setValor(e.target.value.replace(/\D/g, "").slice(0, String(LIMITES_META[tipo].max).length));
            setErro("");
          }}
        />
      </div>
      {erro ? <p className="text-sm font-medium text-danger">{erro}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void salvar()} loading={salvando === "salvar"} disabled={!valor || salvando !== null}>
          Salvar meta
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={salvando !== null}>
          Cancelar
        </Button>
        {inicial ? (
          <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => void salvar(true)} loading={salvando === "remover"} disabled={salvando !== null}>
            Tirar a meta
          </Button>
        ) : null}
      </div>
    </div>
  );
}
