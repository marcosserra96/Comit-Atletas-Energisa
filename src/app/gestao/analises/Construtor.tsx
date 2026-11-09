"use client";

import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { tipoLancamentoLabel } from "@/lib/labels";
import { PERIODOS, type EscolhaAnalise, type PresetPeriodo } from "@/lib/analises/config";
import { DIMENSOES, MEDIDAS, combinacaoInvalida, type Dimensao, type Medida } from "@/lib/analises/motor";
import type { TipoLancamento } from "@/lib/types";

const ORDEM_MEDIDAS: Medida[] = ["treinos", "pontos", "km", "aderencia", "provas", "mesesComTreino", "maiorDistancia", "atletas", "lancamentos"];
const ORDEM_DIMENSOES: Dimensao[] = ["atleta", "equipe", "mes", "criterio", "tipo", "diaSemana", "sexo", "faixaEtaria", "localidade", "entrada"];
const TIPOS: TipoLancamento[] = ["treino", "evento", "avulso", "reuniao"];

const campo =
  "h-11 w-full rounded-[var(--radius)] border border-border bg-bg-card px-3 text-base text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";

function Rotulo({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-text-light">
      {children}
    </label>
  );
}

function Interruptor({ ativo, onChange, rotulo, detalhe, disabled }: { ativo: boolean; onChange: (v: boolean) => void; rotulo: string; detalhe?: string; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-60")}>
      <Switch ativo={ativo} onChange={onChange} rotulo={rotulo} disabled={disabled} className="-ml-1" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{rotulo}</p>
        {detalhe ? <p className="text-xs text-text-light">{detalhe}</p> : null}
      </div>
    </div>
  );
}

/**
 * A pergunta, em partes: o que medir, por o quê, quando, e os filtros. Os
 * filtros menos usados ficam recolhidos para a tela não assustar.
 */
export function Construtor({
  escolha,
  mudar,
  criterios,
}: {
  escolha: EscolhaAnalise;
  mudar: (parcial: Partial<EscolhaAnalise>) => void;
  criterios: { id: string; descricao: string }[];
}) {
  const ids = { de: useId(), ate: useId(), minimo: useId() };
  const filtrosAtivos = [escolha.criterio, escolha.tipo, escolha.sexo !== "todos", !escolha.somenteAtivos, escolha.minimo != null, escolha.top != null, escolha.modo === "media"].filter(Boolean).length;
  const [maisFiltros, setMaisFiltros] = useState(filtrosAtivos > 0);
  const medida = MEDIDAS[escolha.medida];
  const aviso = combinacaoInvalida(escolha.medida, escolha.linhas) ?? combinacaoInvalida(escolha.medida, escolha.colunas);
  const aceitaMedia = medida.agregacao === "soma" && escolha.linhas !== "atleta";

  return (
    <Card className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Rotulo>O que medir</Rotulo>
          <Select value={escolha.medida} onChange={(e) => mudar({ medida: e.target.value as Medida })} aria-label="O que medir">
            {ORDEM_MEDIDAS.map((m) => (
              <option key={m} value={m}>
                {MEDIDAS[m].rotulo}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Rotulo>Por</Rotulo>
          <Select
            value={escolha.linhas}
            onChange={(e) => {
              const linhas = e.target.value as Dimensao;
              mudar({ linhas, colunas: escolha.colunas === linhas ? null : escolha.colunas });
            }}
            aria-label="Agrupar por"
          >
            {ORDEM_DIMENSOES.map((d) => (
              <option key={d} value={d}>
                {DIMENSOES[d].rotulo}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Rotulo>Abrir em colunas</Rotulo>
          <Select value={escolha.colunas ?? ""} onChange={(e) => mudar({ colunas: (e.target.value || null) as Dimensao | null })} aria-label="Abrir em colunas">
            <option value="">Sem colunas</option>
            {ORDEM_DIMENSOES.filter((d) => d !== escolha.linhas && d !== "atleta").map((d) => (
              <option key={d} value={d}>
                {DIMENSOES[d].rotulo}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Rotulo>Período</Rotulo>
          <Select value={escolha.periodo} onChange={(e) => mudar({ periodo: e.target.value as PresetPeriodo })} aria-label="Período">
            {(Object.keys(PERIODOS) as PresetPeriodo[]).map((p) => (
              <option key={p} value={p}>
                {PERIODOS[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {escolha.periodo === "personalizado" ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="flex flex-col gap-1.5">
            <Rotulo htmlFor={ids.de}>De</Rotulo>
            <input id={ids.de} type="date" value={escolha.de} max={escolha.ate || undefined} onChange={(e) => mudar({ de: e.target.value })} className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo htmlFor={ids.ate}>Até</Rotulo>
            <input id={ids.ate} type="date" value={escolha.ate} min={escolha.de || undefined} onChange={(e) => mudar({ ate: e.target.value })} className={campo} />
          </div>
        </div>
      ) : null}

      <p className="-mt-1 text-xs text-text-light [text-wrap:pretty]">{medida.descricao}</p>
      {aviso ? <InlineAlert tone="warning">{aviso}</InlineAlert> : null}

      <div className="flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          value={escolha.equipe}
          onChange={(equipe) => mudar({ equipe })}
          options={[
            { value: "todas", label: "Corrida e Bike" },
            { value: "corrida", label: "Corrida" },
            { value: "bicicleta", label: "Bike" },
          ]}
          className="w-full sm:w-auto"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Interruptor
            ativo={escolha.comparar && !escolha.colunas}
            onChange={(comparar) => mudar({ comparar })}
            rotulo="Comparar com o período anterior"
            detalhe={escolha.colunas ? "Disponível sem colunas" : undefined}
            disabled={!!escolha.colunas}
          />
          {escolha.comparar && !escolha.colunas && escolha.linhas !== "mes" && escolha.linhas !== "diaSemana" ? (
            <SegmentedControl
              value={escolha.ordem}
              onChange={(ordem) => mudar({ ordem })}
              options={[
                { value: "valor", label: "Maior valor" },
                { value: "variacao", label: "Maior evolução" },
              ]}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setMaisFiltros((v) => !v)}
            aria-expanded={maisFiltros}
            className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-[var(--radius)] px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {maisFiltros ? "Menos filtros" : `Mais filtros${filtrosAtivos ? ` (${filtrosAtivos})` : ""}`}
          </button>
        </div>
      </div>

      {maisFiltros ? (
        <div className="grid gap-4 rounded-[var(--radius-lg)] bg-bg-inset/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Rotulo>Critério</Rotulo>
            <Select value={escolha.criterio} onChange={(e) => mudar({ criterio: e.target.value })} searchable={criterios.length > 8} aria-label="Critério">
              <option value="">Todos os critérios</option>
              {criterios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.descricao}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo>Tipo de lançamento</Rotulo>
            <Select value={escolha.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoLancamento | "" })} aria-label="Tipo de lançamento">
              <option value="">Todos os tipos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {tipoLancamentoLabel[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo>Sexo</Rotulo>
            <Select value={escolha.sexo} onChange={(e) => mudar({ sexo: e.target.value as EscolhaAnalise["sexo"] })} aria-label="Sexo">
              <option value="todos">Todos</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor={ids.minimo}>{`Mínimo${medida.unidade ? ` (${medida.unidade})` : ""}`}</Rotulo>
              <input
                id={ids.minimo}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Sem mínimo"
                value={escolha.minimo ?? ""}
                onChange={(e) => mudar({ minimo: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                className={campo}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Rotulo>Mostrar</Rotulo>
              <Select value={escolha.top == null ? "" : String(escolha.top)} onChange={(e) => mudar({ top: e.target.value ? Number(e.target.value) : null })} aria-label="Quantas linhas mostrar">
                <option value="">Todos</option>
                <option value="3">Top 3</option>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
              </Select>
            </div>
          </div>
          <Interruptor ativo={escolha.somenteAtivos} onChange={(somenteAtivos) => mudar({ somenteAtivos })} rotulo="Só atletas ativos" detalhe="Desligado, entram também os inativos" />
          <Interruptor
            ativo={escolha.modo === "media" && aceitaMedia}
            onChange={(v) => mudar({ modo: v ? "media" : "total" })}
            rotulo="Média por atleta"
            detalhe={aceitaMedia ? "Compara grupos de tamanhos diferentes" : escolha.linhas === "atleta" ? "Não se aplica por atleta" : `${medida.rotulo} já é ${medida.agregacao === "media" ? "uma média" : medida.agregacao === "maximo" ? "o maior valor" : "uma contagem"}`}
            disabled={!aceitaMedia}
          />
        </div>
      ) : null}
    </Card>
  );
}
