"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Building2, Calculator, CalendarRange, PieChart } from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { PainelNumeros } from "@/components/ui/PainelNumeros";
import { formatBRL, plural } from "@/lib/format";
import type { CategoriaDespesa, DespesaDoc } from "@/lib/types";

const CATEGORIA_COR: Record<CategoriaDespesa, string> = {
  "Provas / Inscrições": "var(--color-secondary)",
  "Mensalidade Treinador": "#3498db",
  "Encontros e Eventos": "var(--color-accent)",
  "Uniformes e Materiais": "var(--color-primary)",
  Outros: "#95a5a6",
};

const CATEGORIA_ORDEM: CategoriaDespesa[] = [
  "Provas / Inscrições",
  "Mensalidade Treinador",
  "Encontros e Eventos",
  "Uniformes e Materiais",
  "Outros",
];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TODOS_OS_ANOS = "todos";

export function ResumoTab() {
  const anoAtual = new Date().getFullYear();
  const [despesasTodas, setDespesasTodas] = useState<DespesaDoc[] | null>(null);
  const [anoFiltro, setAnoFiltro] = useState<string>(String(anoAtual));

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "despesas"),
      (snap) => setDespesasTodas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DespesaDoc)),
      () => setDespesasTodas([]),
    );
    return unsubscribe;
  }, []);

  const anosDisponiveis = useMemo(
    () => [...new Set((despesasTodas ?? []).map((d) => d.anoReferencia ?? anoAtual))].sort((a, b) => b - a),
    [despesasTodas, anoAtual],
  );

  const despesas = useMemo(() => {
    if (!despesasTodas) return null;
    if (anoFiltro === TODOS_OS_ANOS) return despesasTodas;
    return despesasTodas.filter((d) => (d.anoReferencia ?? anoAtual) === Number(anoFiltro));
  }, [despesasTodas, anoFiltro, anoAtual]);

  const porEquipe = useMemo(() => {
    const acc = new Map<string, { proposto: number; realizado: number }>();
    for (const d of despesas ?? []) {
      const atual = acc.get(d.equipe) ?? { proposto: 0, realizado: 0 };
      atual.proposto += d.totalProposto;
      atual.realizado += d.totalRealizado;
      acc.set(d.equipe, atual);
    }
    return [...acc.entries()].map(([equipe, v]) => ({ equipe, ...v, desvio: v.proposto - v.realizado }));
  }, [despesas]);

  const porEmpresa = useMemo(() => {
    const acc = new Map<string, { proposto: number; realizado: number }>();
    for (const d of despesas ?? []) {
      if (d.rateio && d.rateio.length > 0) {
        // Rateio divide só o realizado — o orçado dessas despesas entra no total
        // geral, mas não é atribuído a uma empresa específica nessa quebra.
        for (const r of d.rateio) {
          const atual = acc.get(r.empresa) ?? { proposto: 0, realizado: 0 };
          atual.realizado += r.valor;
          acc.set(r.empresa, atual);
        }
      } else {
        const chave = d.empresaPagadora?.trim() || "Não informado";
        const atual = acc.get(chave) ?? { proposto: 0, realizado: 0 };
        atual.proposto += d.totalProposto;
        atual.realizado += d.totalRealizado;
        acc.set(chave, atual);
      }
    }
    return [...acc.entries()]
      .map(([empresa, v]) => ({ empresa, ...v, desvio: v.proposto - v.realizado }))
      .sort((a, b) => b.realizado - a.realizado);
  }, [despesas]);

  const porCategoria = useMemo(() => {
    const acc = new Map<CategoriaDespesa, { proposto: number; realizado: number }>();
    for (const d of despesas ?? []) {
      const atual = acc.get(d.categoria) ?? { proposto: 0, realizado: 0 };
      atual.proposto += d.totalProposto;
      atual.realizado += d.totalRealizado;
      acc.set(d.categoria, atual);
    }
    return CATEGORIA_ORDEM.filter((cat) => acc.has(cat)).map((categoria) => {
      const { proposto, realizado } = acc.get(categoria)!;
      const pct = proposto > 0 ? Math.min((realizado / proposto) * 100, 100) : 100;
      const estourou = (realizado > proposto && proposto > 0) || (proposto === 0 && realizado > 0);
      return { categoria, proposto, realizado, pct, estourou };
    });
  }, [despesas]);

  const porMes = useMemo(() => {
    const acc = Array.from({ length: 12 }, () => ({ proposto: 0, realizado: 0 }));
    for (const d of despesas ?? []) {
      if (d.recorrente && d.parcelas?.length) {
        for (const p of d.parcelas) {
          acc[p.mes - 1].proposto += p.valorPrevisto;
          if (p.pago) acc[p.mes - 1].realizado += p.valorPago;
        }
      } else if (d.mesReferencia) {
        acc[d.mesReferencia - 1].proposto += d.totalProposto;
        acc[d.mesReferencia - 1].realizado += d.totalRealizado;
      }
    }
    return acc
      .map((v, i) => ({ mes: MESES[i], ...v, desvio: v.proposto - v.realizado }))
      .filter((m) => m.proposto > 0 || m.realizado > 0);
  }, [despesas]);

  const semMesDefinido = useMemo(
    () => (despesas ?? []).filter((d) => !d.recorrente && !d.mesReferencia).length,
    [despesas],
  );

  const totalProposto = despesas?.reduce((s, d) => s + d.totalProposto, 0) ?? 0;
  const totalRealizado = despesas?.reduce((s, d) => s + d.totalRealizado, 0) ?? 0;
  const saldo = totalProposto - totalRealizado;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <div className="w-40">
          <Select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
            <option value={TODOS_OS_ANOS}>Todos os anos</option>
            {(anosDisponiveis.includes(anoAtual) ? anosDisponiveis : [anoAtual, ...anosDisponiveis]).map((ano) => (
              <option key={ano} value={String(ano)}>
                {ano}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <PainelNumeros
        emLinhasNoCelular
        itens={[
          { rotulo: "Total orçado", valor: formatBRL(totalProposto), detalhe: "Orçamento aprovado" },
          { rotulo: "Total realizado", valor: formatBRL(totalRealizado), detalhe: "Gasto confirmado" },
          {
            rotulo: "Saldo",
            valor: formatBRL(saldo),
            detalhe: saldo < 0 ? "Acima do orçado" : "Orçado menos realizado",
            tom: saldo < 0 ? "danger" : "success",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
            <Calculator className="size-4 text-text-muted" />
            Resumo por equipe
          </h3>
          {despesas === null ? (
            <div className="h-24 animate-pulse rounded-[var(--radius)] bg-bg" />
          ) : porEquipe.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Nenhum dado financeiro registrado</p>
          ) : (
            <TabelaOrcamento
              rotuloNome="Equipe"
              linhas={porEquipe.map((x) => ({ nome: x.equipe, proposto: x.proposto, realizado: x.realizado, desvio: x.desvio }))}
            />
          )}
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
            <PieChart className="size-4 text-text-muted" />
            Por categoria
          </h3>
          {despesas === null ? (
            <div className="h-24 animate-pulse rounded-[var(--radius)] bg-bg" />
          ) : porCategoria.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Registre gastos para ver a distribuição por categoria.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {porCategoria.map((c) => (
                <div
                  key={c.categoria}
                  className="rounded-[var(--radius)] border border-border bg-bg p-3"
                  style={{ borderLeft: `3px solid ${CATEGORIA_COR[c.categoria]}` }}
                >
                  <p className="mb-1.5 text-sm font-semibold text-text">{c.categoria}</p>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-text-light">Orçado: {formatBRL(c.proposto)}</span>
                    <span className="font-semibold" style={{ color: CATEGORIA_COR[c.categoria] }}>
                      Real: {formatBRL(c.realizado)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${c.pct}%`,
                        backgroundColor: c.estourou ? "var(--color-danger)" : CATEGORIA_COR[c.categoria],
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-xs text-text-muted">
                    Desvio:{" "}
                    <strong className={c.proposto - c.realizado < 0 ? "text-danger" : "text-text"}>
                      {formatBRL(c.proposto - c.realizado)}
                    </strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-text">
          <CalendarRange className="size-4 text-text-muted" />
          Resumo por mês
        </h3>
        <p className="mb-3 text-xs text-text-light">
          Parcelas de custos recorrentes e despesas com mês definido.
          {semMesDefinido > 0 &&
            ` ${plural(semMesDefinido, "lançamento", "lançamentos")} sem mês definido ${semMesDefinido === 1 ? "não entra" : "não entram"} nessa quebra.`}
        </p>
        {despesas === null ? (
          <div className="h-24 animate-pulse rounded-[var(--radius)] bg-bg" />
        ) : porMes.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Nenhum custo recorrente ou despesa com mês definido ainda.
          </p>
        ) : (
          <TabelaOrcamento
            rotuloNome="Mês"
            linhas={porMes.map((x) => ({ nome: x.mes, proposto: x.proposto, realizado: x.realizado, desvio: x.desvio }))}
          />
        )}
      </Card>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
          <Building2 className="size-4 text-text-muted" />
          Resumo por empresa pagadora
        </h3>
        {despesas === null ? (
          <div className="h-24 animate-pulse rounded-[var(--radius)] bg-bg" />
        ) : porEmpresa.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">Nenhum dado financeiro registrado</p>
        ) : (
          <TabelaOrcamento
            rotuloNome="Empresa"
            linhas={porEmpresa.map((x) => ({ nome: x.empresa, proposto: x.proposto, realizado: x.realizado, desvio: x.desvio }))}
          />
        )}
      </Card>
    </div>
  );
}


interface LinhaOrcamento {
  nome: string;
  proposto: number;
  realizado: number;
  desvio: number;
}

/** Orçado × realizado. Tabela no computador; no celular, um bloco por linha. */
function TabelaOrcamento({ rotuloNome, linhas }: { rotuloNome: string; linhas: LinhaOrcamento[] }) {
  const corDesvio = (desvio: number) => (desvio < 0 ? "text-danger" : "text-success");
  return (
    <>
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
            <th className="py-2 font-semibold">{rotuloNome}</th>
            <th className="py-2 text-right font-semibold">Orçado</th>
            <th className="py-2 text-right font-semibold">Realizado</th>
            <th className="py-2 text-right font-semibold">Desvio</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3 font-medium text-text">{l.nome}</td>
              <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums text-text-light">{formatBRL(l.proposto)}</td>
              <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums text-text-light">{formatBRL(l.realizado)}</td>
              <td className={`whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums ${corDesvio(l.desvio)}`}>
                {formatBRL(l.desvio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col divide-y divide-border sm:hidden">
        {linhas.map((l) => (
          <li key={l.nome} className="py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-semibold text-text">{l.nome}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-text-muted">Orçado</dt>
                <dd className="font-medium tabular-nums text-text-light">{formatBRL(l.proposto)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Realizado</dt>
                <dd className="font-medium tabular-nums text-text-light">{formatBRL(l.realizado)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-text-muted">Desvio</dt>
                <dd className={`font-bold tabular-nums ${corDesvio(l.desvio)}`}>{formatBRL(l.desvio)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
