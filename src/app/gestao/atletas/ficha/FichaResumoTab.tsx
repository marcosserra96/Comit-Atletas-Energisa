"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { logAudit } from "@/lib/audit";
import { equipeLabel } from "@/lib/labels";
import { formatShortDate } from "@/lib/format";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

const sexoLabel: Record<string, string> = { M: "Masculino", F: "Feminino", Outro: "Prefiro não informar" };

export function FichaResumoTab({ atleta }: { atleta: AtletaDoc }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [resumo, setResumo] = useState<{ km: number; eventos: number } | null>(null);
  const [ativo, setAtivo] = useState(atleta.ativo);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id))).then((snap) => {
      const lotes = new Set<string>();
      let km = 0;
      snap.docs.forEach((d) => {
        const l = d.data() as HistoricoPontoDoc;
        if (l.estornado || lotes.has(l.loteId)) return;
        lotes.add(l.loteId);
        km += l.kmPercorrido ?? 0;
      });
      setResumo({ km, eventos: lotes.size });
    });
  }, [atleta.id]);

  async function handleSalvarStatus() {
    if (ativo === atleta.ativo) {
      show("info", "Nenhuma alteração de status para salvar.");
      return;
    }
    if (!ativo && !motivo.trim()) {
      show("info", "Informe o motivo da desativação.");
      return;
    }
    setSalvando(true);
    try {
      await updateDoc(doc(db, "atletas", atleta.id), { ativo, atualizadoEm: serverTimestamp() });
      await logAudit({
        acao: ativo ? "reativar_atleta" : "desativar_atleta",
        entidade: "atletas",
        entidadeId: atleta.id,
        dados: motivo ? { motivo } : {},
        criadoPor: uid,
        criadoPorNome: autor.nome,
      });
      show("success", ativo ? "Atleta reativado." : "Atleta desativado.");
      setMotivo("");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-border bg-bg p-4">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Total de pontos
          </span>
          <h3 className="text-xl font-extrabold text-text">{atleta.pontuacaoTotal}</h3>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-bg p-4">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
            KM percorridos
          </span>
          <h3 className="text-xl font-extrabold text-text">
            {resumo === null ? "…" : `${resumo.km} km`}
          </h3>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-bg p-4">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Status
          </span>
          <h3 className="text-xl font-extrabold text-text">{atleta.ativo ? "Ativo" : "Inativo"}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-text">
            <UserRound className="size-3.5" />
            Dados rápidos
          </h4>
          <div className="flex flex-col divide-y divide-border">
            <InfoRow label="Equipe" value={equipeLabel[atleta.equipe]} />
            <InfoRow label="Localidade" value={atleta.localidade ?? "—"} />
            <InfoRow
              label="Nascimento"
              value={atleta.dataNascimento ? formatShortDate(atleta.dataNascimento) : "—"}
            />
            <InfoRow label="Sexo" value={atleta.sexo ? sexoLabel[atleta.sexo] : "—"} />
            <InfoRow label="Entrada" value={atleta.anoEntrada ? String(atleta.anoEntrada) : "—"} />
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-text">Status do atleta</h4>
              <p className="text-xs text-text-muted">Ative ou desative diretamente pela ficha.</p>
            </div>
            <button
              role="switch"
              aria-checked={ativo}
              onClick={() => setAtivo((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                ativo ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  ativo ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {!ativo && (
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Justificativa para desativação…"
              className="mb-3 w-full rounded-[var(--radius)] border border-border bg-bg-card p-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          )}
          <Button size="sm" onClick={handleSalvarStatus} loading={salvando} className="w-full justify-center">
            Salvar status
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <strong className="font-semibold text-text">{label}</strong>
      <span className="truncate text-text-light">{value}</span>
    </div>
  );
}
