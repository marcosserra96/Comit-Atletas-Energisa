"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  Search,
  Users,
  Pencil,
  LinkIcon,
  Route,
  Bike,
  Footprints,
  Filter,
  LayoutGrid,
  List,
  FileSpreadsheet,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { equipeLabel, isWaitlisted } from "@/lib/labels";
import { formatShortDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { cn } from "@/lib/cn";
import { FichaAtletaModal } from "./ficha/FichaAtletaModal";
import type { AtletaDoc, Equipe, HistoricoPontoDoc } from "@/lib/types";

type FiltroModalidade = "todas" | "corrida" | "bicicleta";
type Visualizacao = "cards" | "lista";

interface Resumo {
  km: number;
  eventos: number;
  ultimo: string | null;
}

export function VerAtletasTab() {
  const searchParams = useSearchParams();
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [resumos, setResumos] = useState<Record<string, Resumo>>({});
  const [busca, setBusca] = useState(() => searchParams.get("q") ?? "");
  const [filtroModalidade, setFiltroModalidade] = useState<FiltroModalidade>("todas");
  const [filtroSituacao, setFiltroSituacao] = useState<"ativos" | "todos" | "inativos">("ativos");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("cards");
  const [fichaAberta, setFichaAberta] = useState<AtletaDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), orderBy("nome", "asc")),
      (snap) => {
        setAtletas(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
            .filter((a) => a.role === "atleta"),
        );
      },
      () => setAtletas([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    getDocs(collection(db, "historico_pontos")).then((snap) => {
      const acc: Record<string, Resumo> = {};
      const lotesVistos: Record<string, Set<string>> = {};
      snap.docs.forEach((docSnap) => {
        const l = docSnap.data() as HistoricoPontoDoc;
        if (l.estornado) return;
        const atual = acc[l.atletaId] ?? { km: 0, eventos: 0, ultimo: null };
        const lotes = lotesVistos[l.atletaId] ?? new Set<string>();
        if (!lotes.has(l.loteId)) {
          lotes.add(l.loteId);
          atual.km += l.kmPercorrido ?? 0;
          atual.eventos += 1;
        }
        if (!atual.ultimo || l.dataTreino > atual.ultimo) atual.ultimo = l.dataTreino;
        acc[l.atletaId] = atual;
        lotesVistos[l.atletaId] = lotes;
      });
      setResumos(acc);
    });
  }, []);

  const filtrados = useMemo(() => {
    if (!atletas) return [];
    return atletas.filter((a) => {
      const matchModalidade =
        filtroModalidade === "todas" ||
        a.equipe === filtroModalidade ||
        a.equipe === (`fila_${filtroModalidade}` as Equipe);
      const matchBusca =
        a.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (a.localidade ?? "").toLowerCase().includes(busca.toLowerCase());
      const matchSituacao =
        filtroSituacao === "todos" ||
        (filtroSituacao === "ativos" && a.ativo) ||
        (filtroSituacao === "inativos" && !a.ativo);
      return matchModalidade && matchBusca && matchSituacao;
    });
  }, [atletas, busca, filtroModalidade, filtroSituacao]);

  const kmTotal = filtrados.reduce((sum, a) => sum + (resumos[a.id]?.km ?? 0), 0);
  const kmBike = filtrados
    .filter((a) => a.equipe === "bicicleta")
    .reduce((sum, a) => sum + (resumos[a.id]?.km ?? 0), 0);
  const kmCorrida = filtrados
    .filter((a) => a.equipe === "corrida")
    .reduce((sum, a) => sum + (resumos[a.id]?.km ?? 0), 0);
  const totalParticipacoes = filtrados.reduce((sum, a) => sum + (resumos[a.id]?.eventos ?? 0), 0);

  function handleExportar() {
    exportToExcel(
      "lista-atletas.xlsx",
      "Atletas",
      filtrados.map((a) => ({
        Nome: a.nome,
        Email: a.email ?? "",
        Equipe: equipeLabel[a.equipe],
        Pontos: a.pontuacaoTotal,
        "KM total": resumos[a.id]?.km ?? 0,
        Eventos: resumos[a.id]?.eventos ?? 0,
        Status: a.ativo ? "Ativo" : "Inativo",
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Route} color="var(--color-primary)" label="KM total" value={`${kmTotal.toFixed(1)} km`} desc="Soma coletiva dos atletas" />
        <KpiCard icon={Bike} color="var(--color-accent)" label="Bicicleta" value={`${kmBike.toFixed(1)} km`} desc="Quilometragem acumulada" />
        <KpiCard icon={Footprints} color="var(--color-secondary)" label="Corrida" value={`${kmCorrida.toFixed(1)} km`} desc="Quilometragem acumulada" />
        <KpiCard icon={Filter} color="#8b5cf6" label="Filtrados" value={String(filtrados.length)} desc={`${totalParticipacoes} participações`} />
      </div>

      <Card>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-text">Lista de atletas</p>
            <p className="text-xs text-text-light">Clique num atleta para abrir a ficha completa.</p>
          </div>
          <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportar} disabled={filtrados.length === 0}>
            <FileSpreadsheet className="size-3.5" />
            Exportar
          </Button>
          <div className="flex w-fit gap-1 rounded-[var(--radius-sm)] border border-border bg-bg p-[3px]">
            <button
              onClick={() => setVisualizacao("cards")}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-colors",
                visualizacao === "cards"
                  ? "bg-bg-card font-semibold text-primary shadow-sm"
                  : "text-text-light",
              )}
            >
              <LayoutGrid className="size-3.5" />
              Cards
            </button>
            <button
              onClick={() => setVisualizacao("lista")}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-colors",
                visualizacao === "lista"
                  ? "bg-bg-card font-semibold text-primary shadow-sm"
                  : "text-text-light",
              )}
            >
              <List className="size-3.5" />
              Lista
            </button>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text">Buscar</label>
            <div className="flex h-10 items-center gap-2 rounded-[var(--radius)] border border-border bg-bg-card px-3">
              <Search className="size-4 text-text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, cidade ou equipe…"
                className="h-full w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text">Equipe</label>
            <Select
              value={filtroModalidade}
              onChange={(e) => setFiltroModalidade(e.target.value as FiltroModalidade)}
            >
              <option value="todas">Todas as equipes</option>
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bicicleta</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text">Situação</label>
            <Select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value as typeof filtroSituacao)}
            >
              <option value="ativos">Ativos</option>
              <option value="todos">Todos</option>
              <option value="inativos">Inativos</option>
            </Select>
          </div>
        </div>
      </Card>

      {atletas === null ? (
        <Card className="h-40 animate-pulse" />
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum atleta encontrado"
            description="Cadastre atletas ou ajuste os filtros para ver resultados."
          />
        </Card>
      ) : visualizacao === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {a.nome.trim().charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-text">{a.nome}</p>
                    <p className="text-xs text-text-light">{equipeLabel[a.equipe]}</p>
                  </div>
                </div>
                <button
                  onClick={() => setFichaAberta(a)}
                  aria-label="Ver ficha"
                  className="shrink-0 rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-bg hover:text-primary"
                >
                  <Pencil className="size-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={isWaitlisted(a.equipe) ? "warning" : a.ativo ? "success" : "neutral"}>
                  {isWaitlisted(a.equipe) ? "Na fila" : a.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <Badge tone="primary">{a.pontuacaoTotal} pts</Badge>
                {!a.authUid && (
                  <Badge tone="neutral">
                    <LinkIcon className="size-3" />
                    Sem login
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-[#f8fafc] text-left text-xs uppercase tracking-wide text-text-light">
                <th className="px-3.5 py-2.5 font-bold">Atleta</th>
                <th className="px-3.5 py-2.5 font-bold">Equipe</th>
                <th className="px-3.5 py-2.5 font-bold">Pontos</th>
                <th className="px-3.5 py-2.5 font-bold">KM</th>
                <th className="px-3.5 py-2.5 font-bold">Eventos</th>
                <th className="px-3.5 py-2.5 font-bold">Último</th>
                <th className="px-3.5 py-2.5 font-bold">Status</th>
                <th className="px-3.5 py-2.5 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => {
                const resumo = resumos[a.id];
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-primary/[0.03]">
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-text">{a.nome}</p>
                      <p className="text-xs text-text-light">{a.email ?? "—"}</p>
                    </td>
                    <td className="px-3.5 py-2.5 text-text-light">{equipeLabel[a.equipe]}</td>
                    <td className="px-3.5 py-2.5 text-text-light">{a.pontuacaoTotal}</td>
                    <td className="px-3.5 py-2.5 text-text-light">{resumo?.km ?? 0} km</td>
                    <td className="px-3.5 py-2.5 text-text-light">{resumo?.eventos ?? 0}</td>
                    <td className="px-3.5 py-2.5 text-text-light">
                      {resumo?.ultimo ? formatShortDate(resumo.ultimo) : "—"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={isWaitlisted(a.equipe) ? "warning" : a.ativo ? "success" : "neutral"}>
                        {isWaitlisted(a.equipe) ? "Na fila" : a.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Button size="sm" variant="secondary" onClick={() => setFichaAberta(a)}>
                        <Pencil className="size-3.5" />
                        Ficha
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <FichaAtletaModal
        key={fichaAberta?.id ?? "none"}
        atleta={fichaAberta}
        onClose={() => setFichaAberta(null)}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  desc,
}: {
  icon: typeof Route;
  color: string;
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div
      className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-sm"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-light">{label}</p>
        <p className="text-[1.35rem] font-extrabold leading-tight text-text">{value}</p>
        <p className="text-xs text-text-muted">{desc}</p>
      </div>
    </div>
  );
}
