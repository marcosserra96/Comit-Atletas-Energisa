"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { FileSpreadsheet, History } from "lucide-react";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { baixarModeloImportacao, readExcelFile } from "@/lib/excel";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { plural } from "@/lib/format";
import type { AtletaDoc, HistoricoMensalDoc, Modalidade } from "@/lib/types";

interface ValoresHistoricos {
  pontos: string;
  km: string;
  treinos: string;
}

const vazio = (): ValoresHistoricos => ({ pontos: "", km: "", treinos: "" });

function numero(valor: string) {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function competenciaAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function HistoricoMensalTab() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modalidade, setModalidade] = useState<Modalidade>("corrida");
  const [competencia, setCompetencia] = useState(competenciaAnterior);
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [existentes, setExistentes] = useState<Map<string, HistoricoMensalDoc>>(new Map());
  const [valores, setValores] = useState<Record<string, ValoresHistoricos>>({});
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("equipe", "==", modalidade)),
      (snap) => {
        setAtletas(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
            .filter(perfilAtletaVisivel)
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        );
      },
      () => setAtletas([]),
    );
    return unsubscribe;
  }, [modalidade]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "historico_mensal"), where("competencia", "==", competencia)),
      (snap) => {
        const mapa = new Map<string, HistoricoMensalDoc>();
        snap.docs.forEach((d) => {
          const item = { id: d.id, ...d.data() } as HistoricoMensalDoc;
          mapa.set(item.atletaId, item);
        });
        setExistentes(mapa);
      },
      () => setExistentes(new Map()),
    );
    return unsubscribe;
  }, [competencia]);

  function valoresDoAtleta(atletaId: string): ValoresHistoricos {
    const editado = valores[atletaId];
    if (editado) return editado;
    const item = existentes.get(atletaId);
    return item
      ? {
          pontos: item.pontos ? String(item.pontos) : "",
          km: item.km ? String(item.km) : "",
          treinos: item.treinos ? String(item.treinos) : "",
        }
      : vazio();
  }

  const totais = useMemo(() => {
    if (!atletas) return { atletas: 0, pontos: 0, km: 0, treinos: 0 };
    return atletas.reduce(
      (acc, atleta) => {
        const v = valoresDoAtleta(atleta.id);
        const pontos = numero(v.pontos);
        const km = numero(v.km);
        const treinos = Math.floor(numero(v.treinos));
        if (pontos > 0 || km > 0 || treinos > 0) acc.atletas += 1;
        acc.pontos += pontos;
        acc.km += km;
        acc.treinos += treinos;
        return acc;
      },
      { atletas: 0, pontos: 0, km: 0, treinos: 0 },
    );
  }, [atletas, valores]);

  function alterar(atletaId: string, campo: keyof ValoresHistoricos, valor: string) {
    setValores((atual) => ({
      ...atual,
      [atletaId]: { ...(atual[atletaId] ?? vazio()), [campo]: valor },
    }));
  }

  async function handleSalvar() {
    if (!atletas || !competencia) return;
    if (competencia > competenciaAtual()) {
      show("error", "A competência não pode estar no futuro.");
      return;
    }

    setSalvando(true);
    try {
      const batch = writeBatch(db);
      const alterados: string[] = [];

      for (const atleta of atletas) {
        const atual = existentes.get(atleta.id);
        const v = valoresDoAtleta(atleta.id);
        const pontos = numero(v.pontos);
        const km = numero(v.km);
        const treinos = Math.floor(numero(v.treinos));
        const temDados = pontos > 0 || km > 0 || treinos > 0;
        const docId = `${competencia}_${atleta.id}`;
        const ref = doc(db, "historico_mensal", docId);

        if (!temDados && !atual) continue;

        const deltaPontos = pontos - (atual?.pontos ?? 0);
        if (!temDados && atual) {
          batch.delete(ref);
        } else {
          batch.set(
            ref,
            {
              id: docId,
              atletaId: atleta.id,
              atletaNome: atleta.nome,
              equipe: atleta.equipe,
              competencia,
              pontos,
              km,
              treinos,
              criadoPor: atual?.criadoPor ?? uid,
              criadoPorNome: atual?.criadoPorNome ?? autor.nome,
              criadoEm: atual?.criadoEm ?? serverTimestamp(),
              atualizadoEm: serverTimestamp(),
              atualizadoPor: uid,
              atualizadoPorNome: autor.nome,
            },
            { merge: true },
          );
        }

        if (deltaPontos !== 0) {
          batch.update(doc(db, "atletas", atleta.id), {
            pontuacaoTotal: increment(deltaPontos),
            atualizadoEm: serverTimestamp(),
          });
          batch.set(
            atletaPublicoRef(atleta.id),
            { pontuacaoTotal: increment(deltaPontos) },
            { merge: true },
          );
        }
        alterados.push(atleta.id);
      }

      if (alterados.length === 0) {
        show("info", "Não há alterações para salvar.");
        return;
      }

      const auditRef = doc(collection(db, "auditoria"));
      batch.set(auditRef, {
        acao: "salvar_historico_mensal",
        entidade: "historico_mensal",
        entidadeId: competencia,
        dados: {
          competencia,
          modalidade,
          atletasComDados: totais.atletas,
          pontos: totais.pontos,
          km: totais.km,
          treinos: totais.treinos,
        },
        criadoPor: uid,
        criadoPorNome: autor.nome,
        criadoEm: serverTimestamp(),
      });

      await batch.commit();
      const rankingAtualizado = await atualizarRankingAutomaticamente(
        [...new Set(alterados)],
        "historico_mensal",
      );
      show(
        rankingAtualizado ? "success" : "info",
        rankingAtualizado
          ? `Histórico de ${competencia} salvo. Ranking atualizado.`
          : `Histórico de ${competencia} salvo, mas o ranking automático não atualizou. Use "Recalcular agora".`,
      );
    } catch {
      show("error", "Não foi possível salvar o histórico mensal.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleBaixarModelo() {
    if (!atletas) return;
    setBaixando(true);
    try {
      await baixarModeloImportacao({
        arquivo: `historico-${competencia}-${modalidade}.xlsx`,
        aba: "Histórico mensal",
        linhasPreenchidas: atletas.map((a) => {
          const v = valores[a.id] ?? vazio();
          return {
            Atleta: a.nome,
            Pontos: numero(v.pontos) || "",
            KM: numero(v.km) || "",
            Treinos: Math.floor(numero(v.treinos)) || "",
          };
        }),
        campos: [
          {
            coluna: "Atleta",
            largura: 30,
            opcoes: atletas.map((a) => a.nome),
            exemplo: atletas[0]?.nome ?? "Nome do atleta",
            obrigatorio: true,
            descricao: "Nome exatamente igual ao cadastro.",
          },
          {
            coluna: "Pontos",
            largura: 12,
            exemplo: 45,
            descricao: "Total de pontos do atleta no mês.",
          },
          {
            coluna: "KM",
            largura: 12,
            exemplo: 72.5,
            descricao: "Quilometragem total do atleta no mês.",
          },
          {
            coluna: "Treinos",
            largura: 12,
            exemplo: 8,
            descricao: "Quantidade total de treinos do atleta no mês.",
          },
        ],
      });
    } catch {
      show("error", "Não foi possível gerar o modelo.");
    } finally {
      setBaixando(false);
    }
  }

  async function handleImportar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !atletas) return;

    setImportando(true);
    try {
      const linhas = await readExcelFile(file);
      const porNome = new Map(atletas.map((a) => [a.nome.trim().toLowerCase(), a]));
      let encontrados = 0;
      const novos = { ...valores };

      for (const linha of linhas) {
        const nome = linha["atleta"]?.trim();
        if (!nome) continue;
        const atleta = porNome.get(nome.toLowerCase());
        if (!atleta) continue;
        novos[atleta.id] = {
          pontos: linha["pontos"] ?? "",
          km: linha["km"] ?? "",
          treinos: linha["treinos"] ?? "",
        };
        encontrados += 1;
      }

      setValores(novos);
      show(
        encontrados > 0 ? "success" : "info",
        encontrados > 0
          ? `${plural(encontrados, "atleta carregado", "atletas carregados")} da planilha. Revise e clique em Salvar histórico.`
          : "Nenhum atleta da planilha corresponde aos atletas desta modalidade.",
      );
    } catch {
      show("error", "Não foi possível ler a planilha.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
            <History className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-text">Histórico mensal consolidado</h2>
            <p className="text-sm text-text-light">
              Use quando você conhece apenas os totais do mês. Esses dados entram nos totais históricos sem criar atividades fictícias.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Competência</label>
            <input
              type="month"
              value={competencia}
              max={competenciaAtual()}
              onChange={(e) => {
                setCompetencia(e.target.value);
                setValores({});
              }}
              className="h-10 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Modalidade</label>
            <Select
              className="w-44"
              value={modalidade}
              onChange={(e) => {
                setModalidade(e.target.value as Modalidade);
                setValores({});
              }}
            >
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bike</option>
            </Select>
          </div>
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" onClick={handleBaixarModelo} loading={baixando} disabled={!atletas}>
              <FileSpreadsheet className="size-4" />
              Baixar modelo
            </Button>
            <Button variant="outline" onClick={() => inputRef.current?.click()} loading={importando} disabled={!atletas}>
              Importar planilha
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportar} />
          </div>
        </div>
      </Card>

      {atletas === null ? (
        <Card className="h-64 animate-pulse" />
      ) : atletas.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="Nenhum atleta nesta modalidade"
            description="Cadastre atletas ativos antes de lançar o histórico."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {atletas.map((a) => {
              const v = valores[a.id] ?? vazio();
              return (
                <Card key={a.id} padding="sm" className="flex flex-col gap-3">
                  <p className="font-semibold text-text">{a.nome}{!a.ativo ? <span className="ml-2 text-xs font-medium text-text-muted">(inativo)</span> : null}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Campo label="Pontos" value={v.pontos} onChange={(x) => alterar(a.id, "pontos", x)} step="1" />
                    <Campo label="KM" value={v.km} onChange={(x) => alterar(a.id, "km", x)} step="0.01" />
                    <Campo label="Treinos" value={v.treinos} onChange={(x) => alterar(a.id, "treinos", x)} step="1" />
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                  <th className="px-4 py-3 font-semibold">Atleta</th>
                  <th className="px-3 py-3 text-center font-semibold">Pontos</th>
                  <th className="px-3 py-3 text-center font-semibold">KM</th>
                  <th className="px-3 py-3 text-center font-semibold">Treinos</th>
                </tr>
              </thead>
              <tbody>
                {atletas.map((a) => {
                  const v = valores[a.id] ?? vazio();
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-text">{a.nome}{!a.ativo ? <span className="ml-2 text-xs font-medium text-text-muted">(inativo)</span> : null}</td>
                      <td className="px-3 py-2"><TabelaInput value={v.pontos} onChange={(x) => alterar(a.id, "pontos", x)} step="1" /></td>
                      <td className="px-3 py-2"><TabelaInput value={v.km} onChange={(x) => alterar(a.id, "km", x)} step="0.01" /></td>
                      <td className="px-3 py-2"><TabelaInput value={v.treinos} onChange={(x) => alterar(a.id, "treinos", x)} step="1" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-bg-card px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0">
        <p className="text-sm text-text-light">
          {totais.atletas} com dados · {totais.pontos.toLocaleString("pt-BR")} pts · {totais.km.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km · {totais.treinos} treinos
        </p>
        <Button onClick={handleSalvar} loading={salvando} disabled={!atletas || !competencia} className="w-full sm:w-auto">
          Salvar histórico
        </Button>
      </div>
    </div>
  );
}

function TabelaInput({
  value,
  onChange,
  step,
}: {
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-center text-sm tabular-nums text-text outline-none focus:border-primary"
      placeholder="0"
    />
  );
}

function Campo({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-text-light">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[var(--radius)] border border-border bg-bg px-2 text-center text-sm tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        placeholder="0"
      />
    </label>
  );
}
