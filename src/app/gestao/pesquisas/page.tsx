"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { BarChart3, ClipboardList, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { temPermissao } from "@/lib/permissoes";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { plural } from "@/lib/format";
import {
  SITUACAO_LABEL,
  formatarDataHora,
  pesquisaParaEquipe,
  situacaoPesquisa,
  type PesquisaDoc,
  type SituacaoPesquisa,
} from "@/lib/pesquisas";
import type { AtletaDoc } from "@/lib/types";

const TOM_SITUACAO: Record<SituacaoPesquisa, "neutral" | "primary" | "success" | "warning"> = {
  rascunho: "neutral",
  agendada: "primary",
  aberta: "success",
  encerrada: "neutral",
};

const PUBLICO_LABEL = { todos: "Corrida e Bike", corrida: "Corrida", bicicleta: "Bike" } as const;

const ORDEM: Record<SituacaoPesquisa, number> = { aberta: 0, agendada: 1, rascunho: 2, encerrada: 3 };

export default function PesquisasPage() {
  const { usuario } = useActiveSession();
  const router = useRouter();
  const { show } = useToast();
  const [pesquisas, setPesquisas] = useState<PesquisaDoc[] | null>(null);
  const [atletas, setAtletas] = useState<AtletaDoc[]>([]);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [excluindo, setExcluindo] = useState<PesquisaDoc | null>(null);
  const pode = temPermissao(usuario, "pesquisas");

  useEffect(() => {
    if (!pode) return;
    return onSnapshot(
      collection(db, "pesquisas"),
      (snap) => setPesquisas(snap.docs.map((d) => ({ ...(d.data() as PesquisaDoc), id: d.id }))),
      () => setPesquisas([]),
    );
  }, [pode]);

  useEffect(() => {
    if (!pode) return;
    getDocs(query(collection(db, "atletas"), where("ativo", "==", true)))
      .then((snap) =>
        setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc).filter(perfilAtletaVisivel)),
      )
      .catch(() => setAtletas([]));
  }, [pode]);

  // Quantidade de respostas (contagem no servidor: barata, sem baixar as respostas).
  const ids = (pesquisas ?? []).filter((p) => p.publicada).map((p) => p.id).join(",");
  useEffect(() => {
    if (!ids) return;
    let ativo = true;
    Promise.all(
      ids.split(",").map(async (id) => {
        const snap = await getCountFromServer(collection(db, "pesquisas", id, "respostas")).catch(() => null);
        return [id, snap?.data().count ?? 0] as const;
      }),
    ).then((pares) => ativo && setRespostas(Object.fromEntries(pares)));
    return () => {
      ativo = false;
    };
  }, [ids]);

  const ordenadas = useMemo(
    () =>
      [...(pesquisas ?? [])].sort(
        (a, b) =>
          ORDEM[situacaoPesquisa(a)] - ORDEM[situacaoPesquisa(b)] || (b.abreEm || "").localeCompare(a.abreEm || ""),
      ),
    [pesquisas],
  );

  if (!pode) return <NotAuthorized />;

  async function excluir() {
    if (!excluindo) return;
    try {
      // As respostas ficam órfãs na subcoleção; sem a pesquisa, ninguém as vê.
      await deleteDoc(doc(db, "pesquisas", excluindo.id));
      show("success", "Pesquisa excluída.");
      setExcluindo(null);
    } catch {
      show("error", "Não foi possível excluir agora. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pesquisas"
        subtitle="Questionários para os atletas responderem pelo portal, com aviso ao abrir o app."
        icon={ClipboardList}
        actions={
          <Button onClick={() => router.push("/gestao/pesquisas/nova")}>
            <Plus className="size-4" />
            Nova pesquisa
          </Button>
        }
      />

      {pesquisas === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-44 animate-pulse" />
          <Card className="h-44 animate-pulse" />
        </div>
      ) : ordenadas.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma pesquisa ainda"
            description="Monte as perguntas, defina quando a pesquisa abre e fecha, e os atletas recebem o aviso ao abrir o portal."
            action={
              <Button onClick={() => router.push("/gestao/pesquisas/nova")}>
                <Plus className="size-4" />
                Criar a primeira pesquisa
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ordenadas.map((p) => {
            const situacao = situacaoPesquisa(p);
            const elegiveis = atletas.filter((a) => pesquisaParaEquipe(p, a.equipe)).length;
            const total = respostas[p.id] ?? 0;
            const taxa = elegiveis > 0 ? Math.min(100, Math.round((total / elegiveis) * 100)) : 0;
            return (
              <Card key={p.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={p.publicada ? `/gestao/pesquisas/${p.id}/resultados` : `/gestao/pesquisas/${p.id}`}
                      className="font-bold text-text hover:text-primary"
                    >
                      {p.titulo || "Sem título"}
                    </Link>
                    <p className="mt-0.5 text-sm text-text-light">
                      {formatarDataHora(p.abreEm)} → {formatarDataHora(p.fechaEm)}
                    </p>
                  </div>
                  <Badge tone={TOM_SITUACAO[situacao]}>{SITUACAO_LABEL[situacao]}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">{PUBLICO_LABEL[p.publico]}</Badge>
                  <Badge tone="neutral">{plural(p.perguntas?.length ?? 0, "pergunta")}</Badge>
                </div>
                {p.publicada ? (
                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-text-light">Respostas</span>
                      <span className="font-semibold tabular-nums text-text">
                        {total} de {elegiveis} · {taxa}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-inset">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${taxa}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Rascunho: os atletas ainda não veem esta pesquisa.</p>
                )}
                <div className="-mx-2 mt-auto flex flex-wrap gap-1 border-t border-border pt-2">
                  {p.publicada ? (
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/gestao/pesquisas/${p.id}/resultados`)}>
                      <BarChart3 className="size-4" />
                      Resultados
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/gestao/pesquisas/${p.id}`)}>
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/gestao/pesquisas/nova?copiar=${p.id}`)}>
                    <Copy className="size-4" />
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-danger hover:bg-danger/10"
                    onClick={() => setExcluindo(p)}
                    aria-label={`Excluir “${p.titulo}”`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        open={excluindo !== null}
        title="Excluir pesquisa"
        description={
          excluindo && (respostas[excluindo.id] ?? 0) > 0
            ? `“${excluindo.titulo}” já tem ${plural(respostas[excluindo.id], "resposta")}. Excluir apaga a pesquisa e as respostas deixam de aparecer. Não dá para desfazer.`
            : `Excluir “${excluindo?.titulo ?? ""}”? Não dá para desfazer.`
        }
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
      />
    </div>
  );
}
