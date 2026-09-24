"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { Eye, EyeOff, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { consolidarAtividades } from "@/lib/activityConsolidation";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { logAudit } from "@/lib/audit";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { atualizarVisibilidadePerfil } from "@/lib/athleteVisibilityClient";
import { equipeLabel } from "@/lib/labels";
import { formatShortDate } from "@/lib/format";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

const sexoLabel: Record<string, string> = { M: "Masculino", F: "Feminino", Outro: "Prefiro não informar" };

export function FichaResumoTab({ atleta }: { atleta: AtletaDoc }) {
  const { uid, atleta: autor, usuario } = useActiveSession();
  const { show } = useToast();
  const [resumo, setResumo] = useState<{ km: number; eventos: number } | null>(null);
  const [ativo, setAtivo] = useState(atleta.ativo);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const visibilidadeInicial = perfilAtletaVisivel(atleta);
  const [visivelNasListas, setVisivelNasListas] = useState(visibilidadeInicial);
  const [visibilidadeSalva, setVisibilidadeSalva] = useState(visibilidadeInicial);
  const [salvandoVisibilidade, setSalvandoVisibilidade] = useState(false);
  const isAdmin = usuario.role === "administrador";

  useEffect(() => {
    getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id))).then((snap) => {
      const atividades = consolidarAtividades(
        snap.docs.map((d) => d.data() as HistoricoPontoDoc),
      );
      const km = atividades.reduce((total, atividade) => total + atividade.km, 0);
      setResumo({ km, eventos: atividades.length });
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
      const batch = writeBatch(db);
      batch.update(doc(db, "atletas", atleta.id), { ativo, atualizadoEm: serverTimestamp() });
      batch.set(
        atletaPublicoRef(atleta.id),
        { ativo, visivelNasListas: perfilAtletaVisivel(atleta) },
        { merge: true },
      );
      await batch.commit();
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

  async function handleSalvarVisibilidade() {
    if (visivelNasListas === visibilidadeSalva) {
      show("info", "Nenhuma alteração de visibilidade para salvar.");
      return;
    }

    setSalvandoVisibilidade(true);
    try {
      const resultado = await atualizarVisibilidadePerfil(atleta.id, visivelNasListas);
      setVisibilidadeSalva(visivelNasListas);
      show(
        resultado.rankingAtualizado ? "success" : "info",
        visivelNasListas
          ? "Perfil reativado nas visões do portal."
          : resultado.rankingAtualizado
            ? "Perfil ocultado das listas, indicadores e ranking."
            : "Perfil ocultado, mas o ranking não atualizou. Use “Recalcular agora” em Configurar Portal.",
      );
    } catch (error) {
      setVisivelNasListas(visibilidadeSalva);
      show(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a visibilidade deste perfil.",
      );
    } finally {
      setSalvandoVisibilidade(false);
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
            {resumo === null ? "…" : `${resumo.km.toFixed(1)} km`}
          </h3>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-bg p-4">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Status
          </span>
          <h3 className="text-xl font-extrabold text-text">{atleta.ativo ? "Ativo" : "Inativo"}</h3>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${
          isAdmin ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2"
        }`}
      >
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
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  ativo ? "translate-x-5" : "translate-x-0"
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

        {isAdmin && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                {visivelNasListas ? (
                  <Eye className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <EyeOff
                    className="mt-0.5 size-4 shrink-0 text-ranking-gold-text"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <h4 className="text-sm font-bold text-text">Visibilidade do perfil</h4>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {visivelNasListas
                      ? "Aparece normalmente nas listas e resultados do programa."
                      : "Fica apenas em Configurar Portal → Perfis ocultos."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Exibir perfil nas visões do portal"
                aria-checked={visivelNasListas}
                onClick={() => setVisivelNasListas((valor) => !valor)}
                disabled={salvandoVisibilidade}
                className="flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    visivelNasListas ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                      visivelNasListas ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>
            <Button
              size="sm"
              variant={visivelNasListas ? "secondary" : "primary"}
              onClick={handleSalvarVisibilidade}
              loading={salvandoVisibilidade}
              disabled={visivelNasListas === visibilidadeSalva}
              className="w-full justify-center"
            >
              {visivelNasListas ? "Salvar visibilidade" : "Ocultar perfil"}
            </Button>
          </div>
        )}
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
