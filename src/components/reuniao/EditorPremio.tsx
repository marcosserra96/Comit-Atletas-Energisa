"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { MEDIDAS } from "@/lib/analises/motor";
import {
  MAX_CRITERIOS,
  MEDIDAS_COM_MEDIA,
  MEDIDAS_DO_PREMIO,
  MODELOS_DE_PREMIO,
  novoCriterio,
  pesosNormalizados,
  rotuloDoCriterio,
  textoDoValor,
  type CriterioPremio,
  type EquipeDoPremio,
  type MedidaDoPremio,
  type PremioPersonalizado,
  type ResultadoPremio,
} from "@/lib/premiacaoPersonalizada";
import { formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

/** Quem vai ao pódio ganha a cor da medalha na classificação. */
const MEDALHA: Record<number, string> = {
  1: "bg-ranking-gold-bg text-ranking-gold-text",
  2: "bg-ranking-silver-bg text-ranking-silver-text",
  3: "bg-ranking-bronze-bg text-ranking-bronze-text",
};

const NOME_GRUPO = { todas: "Corrida e bike juntas", corrida: "Corrida", bicicleta: "Bike" } as const;

/** Um critério: o que medir, o peso e, quando soma no tempo, se aparece como média por mês. */
function LinhaCriterio({
  criterio,
  usadas,
  meses,
  removivel,
  onChange,
  onRemover,
}: {
  criterio: CriterioPremio;
  usadas: readonly MedidaDoPremio[];
  meses: number;
  removivel: boolean;
  onChange: (c: CriterioPremio) => void;
  onRemover: () => void;
}) {
  const idPeso = useId();
  const temMedia = MEDIDAS_COM_MEDIA.includes(criterio.medida);
  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-bg p-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select
            value={criterio.medida}
            onChange={(e) => {
              const medida = e.target.value as MedidaDoPremio;
              onChange({ ...criterio, medida, exibir: MEDIDAS_COM_MEDIA.includes(medida) ? criterio.exibir : "total" });
            }}
            aria-label="O que medir"
          >
            {MEDIDAS_DO_PREMIO.map((m) => (
              <option key={m} value={m} disabled={m !== criterio.medida && usadas.includes(m)}>
                {MEDIDAS[m].rotulo}
              </option>
            ))}
          </Select>
        </div>
        <label htmlFor={idPeso} className="sr-only">
          Peso de {MEDIDAS[criterio.medida].rotulo}
        </label>
        <div className="flex h-11 shrink-0 items-center rounded-[var(--radius-sm)] border border-border bg-bg-card pr-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <input
            id={idPeso}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={5}
            value={criterio.peso}
            onChange={(e) => onChange({ ...criterio, peso: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
            className="h-full w-14 bg-transparent pl-2.5 text-right text-sm font-semibold tabular-nums text-text outline-none"
          />
          <span className="pl-0.5 text-sm text-text-light">%</span>
        </div>
        {removivel ? (
          <button type="button" onClick={onRemover} aria-label={`Tirar ${MEDIDAS[criterio.medida].rotulo}`} className="flex size-9 shrink-0 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="text-xs text-text-light [text-wrap:pretty]">{MEDIDAS[criterio.medida].descricao}</p>
      {temMedia ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={criterio.exibir === "mediaMensal"}
            onChange={(e) => onChange({ ...criterio, exibir: e.target.checked ? "mediaMensal" : "total" })}
            className="size-4 accent-[var(--color-primary)]"
          />
          <span>
            Mostrar a média por mês <span className="text-text-light">(÷ {meses} {meses === 1 ? "mês" : "meses"})</span>
          </span>
        </label>
      ) : null}
    </li>
  );
}

/** Premiação com critérios: modelo, quem concorre, critérios com peso e a classificação ao vivo. */
export function EditorPremio({ premio, resultado, onChange }: { premio: PremioPersonalizado; resultado?: ResultadoPremio; onChange: (p: PremioPersonalizado) => void }) {
  const usadas = premio.criterios.map((c) => c.medida);
  const soma = premio.criterios.reduce((s, c) => s + c.peso, 0);
  const proporcao = pesosNormalizados(premio.criterios);
  const meses = resultado?.meses ?? 1;
  const mudarCriterio = (i: number, c: CriterioPremio) => onChange({ ...premio, criterios: premio.criterios.map((x, j) => (j === i ? c : x)) });

  return (
    <div className="flex flex-col gap-4 border-t border-border-subtle px-3 pb-3 pt-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Começar de um modelo</span>
        <div className="flex flex-wrap gap-1.5">
          {MODELOS_DE_PREMIO.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.descricao}
              onClick={() => onChange({ ...premio, titulo: m.titulo, periodo: m.periodo, criterios: m.criterios.map((c, i) => ({ ...c, id: premio.criterios[i]?.id ?? `${premio.id}-${i}` })) })}
              className="min-h-9 rounded-full border border-border px-3 text-xs font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:bg-bg-inset/60 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {m.titulo}
            </button>
          ))}
        </div>
      </div>

      <TextField label="Nome do prêmio" value={premio.titulo} maxLength={60} placeholder="Ex.: Atleta do ano" onChange={(e) => onChange({ ...premio, titulo: e.target.value })} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Números de</span>
        <SegmentedControl
          value={premio.periodo}
          onChange={(v) => onChange({ ...premio, periodo: v })}
          className="w-full [&>button]:flex-1"
          options={[
            { value: "reuniao", label: "Período da reunião" },
            { value: "ano", label: "Ano até agora" },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Quem concorre</span>
          <Select value={premio.equipe} onChange={(e) => onChange({ ...premio, equipe: e.target.value as EquipeDoPremio })} aria-label="Quem concorre">
            <option value="separadas">Um pódio por equipe</option>
            <option value="todas">Corrida e bike juntas</option>
            <option value="corrida">Só corrida</option>
            <option value="bicicleta">Só bike</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Atletas</span>
          <Select value={premio.sexo} onChange={(e) => onChange({ ...premio, sexo: e.target.value as PremioPersonalizado["sexo"] })} aria-label="Atletas">
            <option value="todos">Todos</option>
            <option value="F">Só mulheres</option>
            <option value="M">Só homens</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Colocações no pódio</span>
        <SegmentedControl
          value={String(premio.quantidade)}
          onChange={(v) => onChange({ ...premio, quantidade: Number(v) })}
          className="w-full [&>button]:flex-1"
          options={[
            { value: "1", label: "Só o 1º" },
            { value: "2", label: "1º e 2º" },
            { value: "3", label: "1º, 2º e 3º" },
          ]}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text">Critérios e pesos</legend>
        <ul className="flex flex-col gap-2">
          {premio.criterios.map((c, i) => (
            <LinhaCriterio
              key={c.id}
              criterio={c}
              usadas={usadas}
              meses={meses}
              removivel={premio.criterios.length > 1}
              onChange={(novo) => mudarCriterio(i, novo)}
              onRemover={() => onChange({ ...premio, criterios: premio.criterios.filter((_, j) => j !== i) })}
            />
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn("text-xs", soma === 100 ? "text-text-light" : "text-warning")}>
            {soma === 100
              ? "Os pesos somam 100%."
              : `Os pesos somam ${soma}%: a nota usa a proporção (${premio.criterios.map((c, i) => `${rotuloDoCriterio(c)} ${Math.round(proporcao[i])}%`).join(", ")}).`}
          </p>
          {premio.criterios.length < MAX_CRITERIOS ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => onChange({ ...premio, criterios: [...premio.criterios, novoCriterio(usadas)] })}>
              <Plus className="size-4" aria-hidden="true" />
              Adicionar critério
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-text-light [text-wrap:pretty]">
          Em cada critério, quem tem o maior valor ganha 100 e os outros, proporcional. A nota é a média pelos pesos; empate, decide o critério de maior peso. Só atletas ativos.
        </p>
      </fieldset>

      {resultado ? (
        <div className="flex flex-col gap-3">
          {resultado.grupos.map((g) => (
            <section key={g.equipe} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-bold text-text">Classificação agora · {NOME_GRUPO[g.equipe]}</h4>
                <span className="text-xs text-text-light">{g.classificacao.length} concorrendo</span>
              </div>
              {g.classificacao.length === 0 ? (
                <p className="rounded-[var(--radius)] bg-bg-inset/60 px-3 py-2.5 text-sm text-text-light">Ninguém pontuou nesses critérios no período.</p>
              ) : (
                <ol className="divide-y divide-border-subtle overflow-hidden rounded-[var(--radius)] border border-border">
                  {g.classificacao.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 bg-bg-card px-3 py-2">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                          c.posicao <= premio.quantidade ? MEDALHA[c.posicao] : "text-text-light",
                        )}
                      >
                        {c.posicao}º
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text">{c.nome}</span>
                        <span className="block truncate text-xs text-text-light">{premio.criterios.map((cr, i) => textoDoValor(cr, c.valores[i])).join(" · ")}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums text-text">{formatNumero(c.nota, 1)}</span>
                        <span className="block text-[11px] text-text-muted">nota</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
          <p className="text-xs text-text-light">
            {resultado.periodo.nome}. Com medalha, quem vai ao pódio.
          </p>
        </div>
      ) : null}
    </div>
  );
}
