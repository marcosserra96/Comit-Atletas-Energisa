"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmarPerigoModal } from "@/components/ui/ConfirmarPerigoModal";
import { logAudit } from "@/lib/audit";
import { formatShortDate, formatDateTime } from "@/lib/format";
import { EstornarModal } from "./EstornarModal";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

const LIMITE_GERAL = 50;
const LIMITE_POR_ATLETA = 200;

export function ExtratoTab() {
  const { uid, atleta, usuario } = useActiveSession();
  const { show } = useToast();
  const isAdmin = usuario.role === "administrador";
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [atletaFiltro, setAtletaFiltro] = useState("");
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [alvo, setAlvo] = useState<HistoricoPontoDoc | null>(null);
  const [alvoExclusao, setAlvoExclusao] = useState<HistoricoPontoDoc | null>(null);

  useEffect(() => {
    getDocs(collection(db, "atletas")).then((snap) => {
      setAtletas(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
    });
  }, []);

  useEffect(() => {
    const q = atletaFiltro
      ? query(
          collection(db, "historico_pontos"),
          where("atletaId", "==", atletaFiltro),
          orderBy("criadoEm", "desc"),
          limit(LIMITE_POR_ATLETA),
        )
      : query(collection(db, "historico_pontos"), orderBy("criadoEm", "desc"), limit(LIMITE_GERAL));

    const unsubscribe = onSnapshot(
      q,
      (snap) => setLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc)),
      () => setLancamentos([]),
    );
    return unsubscribe;
  }, [atletaFiltro]);

  async function handleEstornar(motivo: string) {
    if (!alvo) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "historico_pontos", alvo.id), {
        estornado: true,
        estornadoEm: serverTimestamp(),
        estornadoPor: uid,
        motivoEstorno: motivo,
      });
      batch.update(doc(db, "atletas", alvo.atletaId), {
        pontuacaoTotal: increment(-alvo.pontos),
        atualizadoEm: serverTimestamp(),
      });
      await batch.commit();
      await logAudit({
        acao: "estornar_lancamento",
        entidade: "historico_pontos",
        entidadeId: alvo.id,
        dados: { motivo, pontos: alvo.pontos, atletaId: alvo.atletaId },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      show("success", "Lançamento estornado.");
      setAlvo(null);
    } catch {
      show("error", "Não foi possível estornar agora. Tente novamente.");
    }
  }

  async function handleExcluir() {
    if (!alvoExclusao) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "historico_pontos", alvoExclusao.id));
      // Se o lançamento ainda estava valendo (não estornado), os pontos precisam sair do total do atleta.
      if (!alvoExclusao.estornado) {
        batch.update(doc(db, "atletas", alvoExclusao.atletaId), {
          pontuacaoTotal: increment(-alvoExclusao.pontos),
          atualizadoEm: serverTimestamp(),
        });
      }
      await batch.commit();
      await logAudit({
        acao: "excluir_lancamento",
        entidade: "historico_pontos",
        entidadeId: alvoExclusao.id,
        dados: {
          atletaId: alvoExclusao.atletaId,
          atletaNome: alvoExclusao.atletaNome,
          regraDesc: alvoExclusao.regraDesc,
          pontos: alvoExclusao.pontos,
          dataTreino: alvoExclusao.dataTreino,
        },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      show("success", "Lançamento excluído permanentemente.");
      setAlvoExclusao(null);
    } catch {
      show("error", "Não foi possível excluir agora. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-light">Filtrar por atleta</label>
          <Select className="w-56" value={atletaFiltro} onChange={(e) => setAtletaFiltro(e.target.value)}>
            <option value="">Todos (últimos {LIMITE_GERAL})</option>
            {(atletas ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {lancamentos === null ? (
        <Card className="h-64 animate-pulse" />
      ) : lancamentos.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="Nenhum lançamento encontrado"
            description={
              atletaFiltro
                ? "Esse atleta ainda não tem lançamentos registrados."
                : "Os lançamentos de pontos aparecem aqui assim que forem registrados."
            }
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                  <th className="px-4 py-3 font-semibold">Atleta</th>
                  <th className="px-3 py-3 font-semibold">Regra</th>
                  <th className="px-3 py-3 font-semibold">Data</th>
                  <th className="px-3 py-3 text-right font-semibold">Pontos</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Registrado por</th>
                  <th className="px-3 py-3 font-semibold">Registrado em</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text">{l.atletaNome}</td>
                    <td className="px-3 py-3 text-text-light">{l.regraDesc}</td>
                    <td className="px-3 py-3 text-text-light">{formatShortDate(l.dataTreino)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-text">
                      {l.estornado ? (
                        <span className="text-text-muted line-through">+{l.pontos}</span>
                      ) : (
                        <span className="text-success">+{l.pontos}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={l.estornado ? "danger" : "success"}>
                        {l.estornado ? "Estornado" : "Válido"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-text-light">{l.criadoPorNome}</td>
                    <td className="px-3 py-3 text-text-light">{formatDateTime(l.criadoEm)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!l.estornado && (
                          <button
                            onClick={() => setAlvo(l)}
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                          >
                            <RotateCcw className="size-3.5" />
                            Estornar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setAlvoExclusao(l)}
                            aria-label="Excluir lançamento"
                            title="Excluir permanentemente"
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {!atletaFiltro && (
            <p className="text-xs text-text-muted">
              Mostrando os {LIMITE_GERAL} lançamentos mais recentes. Filtre por atleta pra ver o histórico completo dele.
            </p>
          )}
        </>
      )}

      <EstornarModal lancamento={alvo} onClose={() => setAlvo(null)} onConfirm={handleEstornar} />

      <ConfirmarPerigoModal
        open={alvoExclusao !== null}
        titulo="Excluir lançamento"
        descricao={`Essa ação apaga permanentemente o lançamento de ${alvoExclusao?.atletaNome} (${alvoExclusao?.regraDesc}, +${alvoExclusao?.pontos} pts) e não pode ser desfeita.`}
        palavraChave="EXCLUIR"
        onClose={() => setAlvoExclusao(null)}
        onConfirm={handleExcluir}
      />
    </div>
  );
}
