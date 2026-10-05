"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, ClipboardList, Download, Inbox, Pencil, Star } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SportBadge } from "@/components/ui/SportBadge";
import { temPermissao } from "@/lib/permissoes";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { exportToExcel } from "@/lib/excel";
import { plural } from "@/lib/format";
import {
  SITUACAO_LABEL,
  TIPO_PERGUNTA_LABEL,
  formatarDataHora,
  linhasExportacao,
  pesquisaParaEquipe,
  resultadosDaPesquisa,
  situacaoPesquisa,
  type PesquisaDoc,
  type ResultadoOpcao,
  type ResultadoPergunta,
  type RespostaPesquisaDoc,
} from "@/lib/pesquisas";
import type { AtletaDoc } from "@/lib/types";

function dataDaResposta(valor: unknown) {
  const d = (valor as { toDate?: () => Date } | undefined)?.toDate?.();
  return d ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
}

/** Barras horizontais: uma cor (magnitude), valor escrito ao lado; sem legenda (série única). */
function Barras({ itens, rotulo }: { itens: ResultadoOpcao[]; rotulo?: (o: ResultadoOpcao) => string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {itens.map((o) => (
        <li key={o.opcao} title={`${o.opcao}: ${o.total} (${o.percentual}%)`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-text">{rotulo ? rotulo(o) : o.opcao}</span>
            <span className="shrink-0 tabular-nums text-text-light">
              <strong className="text-text">{o.percentual}%</strong> · {o.total}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-bg-inset">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${o.percentual}%`, minWidth: o.total > 0 ? 6 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Faixas usuais do NPS. */
function zonaNps(nps: number) {
  if (nps >= 75) return { rotulo: "Excelente", tom: "success" as const };
  if (nps >= 50) return { rotulo: "Muito bom", tom: "success" as const };
  if (nps >= 0) return { rotulo: "Razoável", tom: "warning" as const };
  return { rotulo: "Crítico", tom: "danger" as const };
}

function Numero({ valor, rotulo }: { valor: number | null; rotulo: string }) {
  return (
    <div className="rounded-[var(--radius)] bg-bg-inset px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{rotulo}</p>
      <p className="text-2xl font-black tabular-nums text-text">{valor === null ? "—" : valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function CartaoResultado({ r, indice }: { r: ResultadoPergunta; indice: number }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Pergunta {indice + 1} · {TIPO_PERGUNTA_LABEL[r.pergunta.tipo]}
        </p>
        <h3 className="mt-1 font-bold text-text">{r.pergunta.enunciado}</h3>
        <p className="text-sm text-text-light">{plural(r.responderam, "resposta")}</p>
      </div>
      {r.responderam === 0 ? (
        <p className="text-sm text-text-muted">Ninguém respondeu esta pergunta ainda.</p>
      ) : r.tipo === "opcoes" ? (
        <Barras itens={r.opcoes} />
      ) : r.tipo === "escala" ? (
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-2">
            <Star className="size-7 fill-current text-ranking-gold" aria-hidden="true" />
            <span className="text-4xl font-black tabular-nums text-text">{r.media?.toLocaleString("pt-BR")}</span>
            <span className="text-sm text-text-light">média</span>
          </div>
          <Barras itens={r.distribuicao} rotulo={(o) => `Nota ${o.opcao}`} />
        </div>
      ) : r.tipo === "nps" ? (
        <div className="flex flex-col gap-5">
          {r.nps ? (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">NPS</p>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-black tabular-nums text-text">{r.nps.nps}</span>
                  <Badge tone={zonaNps(r.nps.nps).tom}>{zonaNps(r.nps.nps).rotulo}</Badge>
                </div>
              </div>
              <p className="text-sm text-text-light">
                Média {r.media?.toLocaleString("pt-BR")} · Promotores (9–10) <strong className="text-text">{r.nps.promotores}%</strong>{" "}
                · Neutros (7–8) <strong className="text-text">{r.nps.neutros}%</strong> · Detratores (0–6){" "}
                <strong className="text-text">{r.nps.detratores}%</strong>
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-11 items-end gap-1" role="img" aria-label="Distribuição das notas de 0 a 10">
            {r.distribuicao.map((o) => (
              <div key={o.opcao} className="flex flex-col items-center gap-1" title={`Nota ${o.opcao}: ${o.total}`}>
                <span className="text-[11px] tabular-nums text-text-light">{o.total || ""}</span>
                <div className="flex h-20 w-full items-end rounded-[4px] bg-bg-inset">
                  <div
                    className="w-full rounded-[4px] bg-primary transition-[height] duration-500"
                    style={{ height: `${o.percentual}%`, minHeight: o.total > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-text">{o.opcao}</span>
              </div>
            ))}
          </div>
        </div>
      ) : r.tipo === "ordem" ? (
        <ol className="flex flex-col gap-2">
          {r.opcoes.map((o, i) => (
            <li key={o.opcao} className="flex items-center gap-3 rounded-[var(--radius)] border border-border px-3 py-2.5">
              <span
                className={
                  i === 0
                    ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary"
                    : "flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-inset text-sm font-bold text-text-light"
                }
              >
                {i + 1}º
              </span>
              <span className="min-w-0 flex-1 font-semibold text-text">{o.opcao}</span>
              <span className="shrink-0 text-right text-xs text-text-light">
                posição média <strong className="tabular-nums text-text">{o.posicaoMedia.toLocaleString("pt-BR")}</strong>
                <br />
                1º lugar para {plural(o.primeiroLugar, "atleta")}
              </span>
            </li>
          ))}
        </ol>
      ) : r.tipo === "numero" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Numero rotulo="Média" valor={r.media} />
            <Numero rotulo="Menor" valor={r.minimo} />
            <Numero rotulo="Maior" valor={r.maximo} />
          </div>
          <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-[var(--radius)] border border-border">
            {r.valores.map((v, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-text">{v.atletaNome}</span>
                <span className="font-semibold tabular-nums text-text">{v.valor.toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-[var(--radius)] border border-border">
          {r.textos.map((t, i) => (
            <li key={i} className="px-3 py-2.5 text-sm">
              <p className="whitespace-pre-line text-text">{t.texto}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t.atletaNome}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ResultadosPesquisaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const pode = temPermissao(usuario, "pesquisas");
  const [pesquisa, setPesquisa] = useState<PesquisaDoc | null | undefined>(undefined);
  const [respostas, setRespostas] = useState<RespostaPesquisaDoc[] | null>(null);
  const [atletas, setAtletas] = useState<AtletaDoc[]>([]);
  const [lista, setLista] = useState<"responderam" | "faltam">("responderam");

  useEffect(() => {
    if (!pode) return;
    const parar1 = onSnapshot(
      doc(db, "pesquisas", id),
      (snap) => setPesquisa(snap.exists() ? { ...(snap.data() as PesquisaDoc), id: snap.id } : null),
      () => setPesquisa(null),
    );
    // Respostas ao vivo: dá para acompanhar enquanto a pesquisa está aberta.
    const parar2 = onSnapshot(
      collection(db, "pesquisas", id, "respostas"),
      (snap) => setRespostas(snap.docs.map((d) => d.data() as RespostaPesquisaDoc)),
      () => setRespostas([]),
    );
    getDocs(query(collection(db, "atletas"), where("ativo", "==", true)))
      .then((snap) =>
        setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc).filter(perfilAtletaVisivel)),
      )
      .catch(() => setAtletas([]));
    return () => {
      parar1();
      parar2();
    };
  }, [pode, id]);

  const resultados = useMemo(
    () => (pesquisa && respostas ? resultadosDaPesquisa(pesquisa.perguntas, respostas) : []),
    [pesquisa, respostas],
  );
  const elegiveis = useMemo(
    () => (pesquisa ? atletas.filter((a) => pesquisaParaEquipe(pesquisa, a.equipe)) : []),
    [atletas, pesquisa],
  );

  if (!pode) return <NotAuthorized />;
  if (pesquisa === undefined || respostas === null) return <Card className="h-96 animate-pulse" />;
  if (pesquisa === null) {
    return (
      <Card>
        <EmptyState icon={ClipboardList} title="Pesquisa não encontrada" description="Ela pode ter sido excluída." />
      </Card>
    );
  }

  const responderamIds = new Set(respostas.map((r) => r.atletaId));
  const faltam = elegiveis.filter((a) => !responderamIds.has(a.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const responderam = [...respostas].sort((a, b) => a.atletaNome.localeCompare(b.atletaNome, "pt-BR"));
  const taxa = elegiveis.length > 0 ? Math.min(100, Math.round((respostas.length / elegiveis.length) * 100)) : 0;
  const situacao = situacaoPesquisa(pesquisa);

  async function exportar() {
    if (!pesquisa || !respostas) return;
    if (respostas.length === 0) return show("info", "Ainda não há respostas para exportar.");
    const nome = pesquisa.titulo.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[^a-z0-9]+/g, "-");
    await exportToExcel(`pesquisa-${nome}.xlsx`, "Respostas", linhasExportacao(pesquisa.perguntas, responderam, dataDaResposta));
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <Link
          href="/gestao/pesquisas"
          className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text"
        >
          <ArrowLeft className="size-4" />
          Pesquisas
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-text">{pesquisa.titulo}</h1>
            <p className="mt-1 text-sm text-text-light">
              {formatarDataHora(pesquisa.abreEm)} → {formatarDataHora(pesquisa.fechaEm)} ·{" "}
              {SITUACAO_LABEL[situacao]}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/gestao/pesquisas/${id}`)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button onClick={exportar}>
              <Download className="size-4" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </div>

      <Card className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm text-text-light">Taxa de resposta</p>
          <p className="text-3xl font-black tabular-nums text-text">
            {taxa}%
            <span className="ml-2 text-base font-semibold text-text-light">
              {respostas.length} de {elegiveis.length} atletas
            </span>
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-bg-inset">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${taxa}%` }} />
          </div>
        </div>
        {situacao === "aberta" ? (
          <Badge tone="success">Recebendo respostas agora</Badge>
        ) : (
          <Badge tone="neutral">{SITUACAO_LABEL[situacao]}</Badge>
        )}
      </Card>

      {respostas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="Nenhuma resposta ainda"
            description={
              situacao === "agendada"
                ? `A pesquisa abre em ${formatarDataHora(pesquisa.abreEm)}.`
                : "As respostas aparecem aqui assim que os atletas responderem."
            }
          />
        </Card>
      ) : (
        resultados.map((r, i) => <CartaoResultado key={r.pergunta.id} r={r} indice={i} />)
      )}

      <Card className="flex flex-col gap-4">
        <SegmentedControl
          value={lista}
          onChange={(v) => setLista(v as typeof lista)}
          options={[
            { value: "responderam", label: `Responderam (${responderam.length})` },
            { value: "faltam", label: `Faltam (${faltam.length})` },
          ]}
        />
        <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
          {(lista === "responderam"
            ? responderam.map((r) => ({ id: r.atletaId, nome: r.atletaNome, equipe: r.equipe, extra: dataDaResposta(r.respondidoEm) }))
            : faltam.map((a) => ({ id: a.id, nome: a.nome, equipe: a.equipe, extra: "" }))
          ).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-text">{p.nome}</span>
              {p.extra ? <span className="shrink-0 text-xs text-text-muted">{p.extra}</span> : null}
              {p.equipe === "corrida" || p.equipe === "bicicleta" ? <SportBadge modalidade={p.equipe} size="sm" /> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
