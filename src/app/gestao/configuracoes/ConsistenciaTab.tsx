"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { AlertTriangle, Check, GitMerge, Mail, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmarPerigoModal } from "@/components/ui/ConfirmarPerigoModal";
import { equipeLabel } from "@/lib/labels";
import {
  carregarParesIgnorados,
  detectarGruposDuplicados,
  ignorarPares,
  mesclarAtletas,
  paresDoGrupo,
  type GrupoDuplicado,
} from "@/lib/duplicados";
import type { AtletaDoc } from "@/lib/types";

/** Escolhe um "candidato natural" a registro correto: quem tem login, depois quem tem mais pontos. */
function candidatoPadrao(membros: AtletaDoc[]): string {
  return [...membros].sort((a, b) => {
    const scoreA = (a.authUid ? 1_000_000 : 0) + a.pontuacaoTotal;
    const scoreB = (b.authUid ? 1_000_000 : 0) + b.pontuacaoTotal;
    return scoreB - scoreA;
  })[0].id;
}

interface AlvoFusao {
  grupo: GrupoDuplicado;
  canonicalId: string;
  perdedores: AtletaDoc[];
  totalLancamentos: number;
}

export function ConsistenciaTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [paresIgnorados, setParesIgnorados] = useState<Set<string> | null>(null);
  const [selecaoPorGrupo, setSelecaoPorGrupo] = useState<Record<string, string>>({});
  const [preparando, setPreparando] = useState<string | null>(null);
  const [alvoFusao, setAlvoFusao] = useState<AlvoFusao | null>(null);
  const [ignorando, setIgnorando] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "atletas"),
      (snap) => setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setAtletas([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    carregarParesIgnorados()
      .then(setParesIgnorados)
      .catch(() => setParesIgnorados(new Set()));
  }, []);

  const grupos = useMemo(() => {
    if (!atletas || !paresIgnorados) return null;
    return detectarGruposDuplicados(atletas, paresIgnorados);
  }, [atletas, paresIgnorados]);

  function selecaoAtual(grupo: GrupoDuplicado): string {
    return selecaoPorGrupo[grupo.chave] ?? candidatoPadrao(grupo.membros);
  }

  async function handleIgnorarGrupo(grupo: GrupoDuplicado) {
    setIgnorando(grupo.chave);
    try {
      const pares = paresDoGrupo(grupo);
      await ignorarPares(pares);
      setParesIgnorados((prev) => new Set([...(prev ?? []), ...pares]));
      show("info", "Marcado como não sendo a mesma pessoa — não vai mais aparecer aqui.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setIgnorando(null);
    }
  }

  async function handleAbrirConfirmacao(grupo: GrupoDuplicado) {
    const canonicalId = selecaoAtual(grupo);
    const perdedores = grupo.membros.filter((m) => m.id !== canonicalId);
    setPreparando(grupo.chave);
    try {
      let totalLancamentos = 0;
      for (const p of perdedores) {
        const snap = await getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", p.id)));
        totalLancamentos += snap.size;
      }
      setAlvoFusao({ grupo, canonicalId, perdedores, totalLancamentos });
    } catch {
      show("error", "Não foi possível preparar a fusão agora. Tente novamente.");
    } finally {
      setPreparando(null);
    }
  }

  async function handleConfirmarFusao() {
    if (!alvoFusao) return;
    try {
      const resultado = await mesclarAtletas({
        canonicalId: alvoFusao.canonicalId,
        perdedoresIds: alvoFusao.perdedores.map((p) => p.id),
        uid,
        autorNome: atleta.nome,
      });
      show(
        "success",
        `Mesclado. ${resultado.lancamentosMigrados} lançamento(s), ${resultado.comentariosMigrados} comentário(s) e ${resultado.eventosAtualizados} inscrição(ões) migrados.`,
      );
      setAlvoFusao(null);
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Não foi possível mesclar agora. Tente novamente.");
      throw err;
    }
  }

  const carregando = atletas === null || paresIgnorados === null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-text">Conferência de duplicados</h3>
            <p className="mt-0.5 text-xs text-text-light">
              Compara todos os atletas por nome (ignorando acento/maiúscula) e por e-mail, e mostra
              quem parece ser a mesma pessoa cadastrada mais de uma vez — normalmente sobra de
              importações de planilha com um nome digitado um pouco diferente. Ao mesclar, todo o
              histórico de pontos, comentários e inscrições em eventos passa pro registro escolhido
              antes de qualquer coisa ser apagada.
            </p>
          </div>
        </div>
      </Card>

      {carregando ? (
        <Card className="h-40 animate-pulse" />
      ) : grupos && grupos.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum duplicado encontrado"
            description="Todos os atletas cadastrados parecem ser pessoas distintas."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {grupos!.map((grupo) => {
            const canonicalId = selecaoAtual(grupo);
            return (
              <Card key={grupo.chave} className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users2 className="size-4 text-accent" />
                    <h4 className="text-sm font-bold text-text">
                      {grupo.membros.length} cadastros parecem ser a mesma pessoa
                    </h4>
                  </div>
                  <Badge tone="warning">Possível duplicata</Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.membros.map((membro) => {
                    const selecionado = membro.id === canonicalId;
                    return (
                      <button
                        key={membro.id}
                        type="button"
                        onClick={() =>
                          setSelecaoPorGrupo((prev) => ({ ...prev, [grupo.chave]: membro.id }))
                        }
                        className={`flex flex-col items-start gap-1.5 rounded-[var(--radius)] border p-3 text-left transition-colors ${
                          selecionado
                            ? "border-primary bg-primary/[0.06]"
                            : "border-border bg-bg hover:border-primary/40"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 truncate font-semibold text-text">
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                selecionado ? "border-primary bg-primary" : "border-border"
                              }`}
                            >
                              {selecionado && <Check className="size-2.5 text-white" strokeWidth={3.5} />}
                            </span>
                            <span className="truncate">{membro.nome}</span>
                          </span>
                          {membro.authUid && (
                            <span title="Tem login" className="shrink-0 text-primary">
                              <ShieldCheck className="size-3.5" />
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 truncate text-xs text-text-light">
                          <Mail className="size-3 shrink-0" />
                          {membro.email ?? "sem e-mail"}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral" className="px-2 py-0.5 text-[10px]">
                            {equipeLabel[membro.equipe]}
                          </Badge>
                          <span className="text-[10.5px] font-semibold text-text-muted">
                            {membro.pontuacaoTotal} pts
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <p className="text-xs text-text-muted">
                    Marcado com <ShieldCheck className="inline size-3 -translate-y-px" /> = tem login
                    ativo. O selecionado (com o círculo preenchido) é quem sobrevive à fusão.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIgnorarGrupo(grupo)}
                      loading={ignorando === grupo.chave}
                    >
                      Não são a mesma pessoa
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleAbrirConfirmacao(grupo)}
                      loading={preparando === grupo.chave}
                    >
                      <GitMerge className="size-3.5" />
                      Mesclar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmarPerigoModal
        open={!!alvoFusao}
        titulo="Mesclar registros duplicados"
        descricao={
          alvoFusao
            ? `${alvoFusao.perdedores.map((p) => p.nome).join(", ")} ${alvoFusao.perdedores.length > 1 ? "serão apagados" : "será apagado"} depois de migrar ${alvoFusao.totalLancamentos} lançamento(s), comentários e inscrições em eventos pra "${alvoFusao.grupo.membros.find((m) => m.id === alvoFusao.canonicalId)?.nome}". A pontuação total é recalculada a partir do histórico depois da fusão.`
            : ""
        }
        palavraChave="MESCLAR"
        confirmarLabel="Confirmar fusão"
        onClose={() => setAlvoFusao(null)}
        onConfirm={handleConfirmarFusao}
      />

      {!carregando && grupos && grupos.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-text-muted">
          <AlertTriangle className="size-3.5 shrink-0" />
          Se dois cadastros tiverem login próprio (contas diferentes), a fusão fica bloqueada — corrija
          o vínculo de um deles primeiro em "Usuários e permissões".
        </p>
      )}
    </div>
  );
}
