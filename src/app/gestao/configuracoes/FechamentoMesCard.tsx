"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { CalendarCheck2, Minus, Plus, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LIMITES_DIAS_FECHAMENTO, normalizarDiasDoFechamento } from "@/lib/resumoPeriodo";

const btn =
  "flex size-10 items-center justify-center rounded-[var(--radius)] border border-border text-text-light transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40";

/**
 * Até que dia do mês seguinte o resumo do mês espera a confirmação do comitê.
 * Passado esse dia sem confirmação, ele sai sozinho para os atletas.
 */
export function FechamentoMesCard() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [salvo, setSalvo] = useState<number | null>(null);
  const [dias, setDias] = useState(14);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    getDoc(doc(db, "configuracoes", "fechamento_mes"))
      .then((snap) => {
        if (!ativo) return;
        const n = normalizarDiasDoFechamento(snap.data()?.diasAteFecharSozinho);
        setSalvo(n);
        setDias(n);
      })
      .catch(() => ativo && setSalvo(14));
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "configuracoes", "fechamento_mes"), { diasAteFecharSozinho: dias, atualizadoEm: serverTimestamp(), atualizadoPor: uid }, { merge: true });
      addAuditToBatch(batch, {
        acao: "fechamento_mes_atualizado",
        entidade: "configuracoes",
        entidadeId: "fechamento_mes",
        dados: { diasAteFecharSozinho: dias },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      await batch.commit();
      setSalvo(dias);
      show("success", `Pronto. Sem confirmação, o resumo sai sozinho no dia ${dias}.`);
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const { min, max } = LIMITES_DIAS_FECHAMENTO;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <CalendarCheck2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-text">Fechamento do mês</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-light">
            Os atletas recebem o resumo do mês (e do trimestre ou do ano, quando fecham junto) quando quem lança pontos confirma que está tudo lançado. Se
            ninguém confirmar, ele sai sozinho no dia escolhido aqui, às 10h.
          </p>
        </div>
      </div>
      {salvo === null ? (
        <div className="mt-4 h-11 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-text">Sai sozinho no dia</span>
          <div className="flex items-center gap-1.5" role="group" aria-label="Dia do envio automático">
            <button type="button" className={btn} onClick={() => setDias((d) => Math.max(min, d - 1))} disabled={dias <= min} aria-label="Um dia antes">
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="w-10 text-center text-lg font-bold tabular-nums text-text" aria-live="polite">
              {dias}
            </span>
            <button type="button" className={btn} onClick={() => setDias((d) => Math.min(max, d + 1))} disabled={dias >= max} aria-label="Um dia depois">
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <span className="text-sm text-text-light">do mês seguinte</span>
          {dias !== salvo ? (
            <Button size="sm" className="ml-auto" onClick={() => void salvar()} loading={salvando}>
              <Save className="size-4" aria-hidden="true" />
              Salvar
            </Button>
          ) : null}
        </div>
      )}
      <p className="mt-3 text-xs text-text-muted">Entre o dia {min} e o dia {max}. Até lá, quem lança pontos vê a pergunta na Pontuação e no Início da gestão.</p>
    </Card>
  );
}
