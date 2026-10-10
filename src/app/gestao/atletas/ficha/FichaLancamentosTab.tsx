"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { History } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPontos, plural } from "@/lib/format";
import { editarLancamento, estornarLancamentos } from "@/lib/lancamentosOperacoes";
import type { MudancasLancamento } from "@/lib/extrato";
import { EstornarModal } from "../../pontuacao/EstornarModal";
import { LinhaLancamento } from "../../pontuacao/extrato/LinhaLancamento";
import { EditarLancamentoModal } from "../../pontuacao/extrato/EditarLancamentoModal";
import type { AtletaDoc, HistoricoPontoDoc, RegraPontuacaoDoc } from "@/lib/types";

/** Lançamentos do atleta na ficha: mesma linha, edição e estorno do Extrato. */
export function FichaLancamentosTab({ atleta }: { atleta: AtletaDoc }) {
  const { uid, atleta: autorAtleta, usuario } = useActiveSession();
  const { show } = useToast();
  const autor = useMemo(() => ({ uid, nome: autorAtleta.nome }), [uid, autorAtleta.nome]);
  const podeRegistrar = usuario.role === "administrador" || (usuario.permissoes ?? []).includes("registrar");
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[]>([]);
  const [estornando, setEstornando] = useState<HistoricoPontoDoc[] | null>(null);
  const [editando, setEditando] = useState<HistoricoPontoDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc);
        docs.sort((a, b) => (a.dataTreino < b.dataTreino ? 1 : -1));
        setLancamentos(docs);
      },
      () => setLancamentos([]),
    );
    void getDocs(collection(db, "regras_pontuacao"))
      .then((snap) => setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc)))
      .catch(() => undefined);
    return unsubscribe;
  }, [atleta.id]);

  function avisar(ranking: boolean, ok: string) {
    show(ranking ? "success" : "info", ranking ? `${ok} Ranking atualizado.` : `${ok} O ranking automático não atualizou; use "Recalcular agora".`);
  }

  async function confirmarEstorno(motivo: string) {
    if (!estornando) return;
    try {
      avisar(await estornarLancamentos(estornando, motivo, autor, "estorno_ficha_atleta"), "Lançamento estornado.");
      setEstornando(null);
    } catch {
      show("error", "Não foi possível estornar agora. Tente novamente.");
    }
  }

  async function salvarEdicao(m: MudancasLancamento, motivo: string) {
    if (!editando) return;
    try {
      const r = await editarLancamento(editando, m, autor, motivo);
      setEditando(null);
      if (r) avisar(r.ranking, "Lançamento corrigido.");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível salvar a correção agora.");
    }
  }

  if (lancamentos === null) {
    return <div className="h-40 animate-pulse rounded-[var(--radius)] bg-bg" />;
  }

  if (lancamentos.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhum lançamento ainda"
        description="Pontuação, faltas e KM registrados para este atleta aparecem aqui."
      />
    );
  }

  const validos = lancamentos.filter((l) => !l.estornado);
  const total = validos.reduce((s, l) => s + l.pontos, 0);

  return (
    <>
      <p className="mb-2 text-sm text-text-light">
        {plural(lancamentos.length, "lançamento")} · <span className="font-semibold text-text">{formatPontos(total)} pts válidos</span>
      </p>
      <ul className="divide-y divide-border-subtle rounded-[var(--radius)] border border-border bg-bg px-3.5">
        {lancamentos.map((l) => (
          <li key={l.id}>
            <LinhaLancamento
              lancamento={l}
              modo="ficha"
              onEditar={podeRegistrar ? setEditando : undefined}
              onEstornar={podeRegistrar ? (x) => setEstornando([x]) : undefined}
            />
          </li>
        ))}
      </ul>

      <EditarLancamentoModal lancamento={editando} regras={regras} onClose={() => setEditando(null)} onSalvar={salvarEdicao} />
      <EstornarModal itens={estornando} onClose={() => setEstornando(null)} onConfirm={confirmarEstorno} />
    </>
  );
}
