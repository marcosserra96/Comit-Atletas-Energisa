"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { Check, CircleSlash, Lock } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import { ehReuniao } from "@/lib/eventos";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  DETALHE_MAXIMO,
  MOTIVOS_AUSENCIA_EVENTO,
  textoAusencia,
  validarAusenciaEvento,
  type AusenciaEvento,
  type MotivoAusenciaEvento,
} from "@/lib/ausenciasEvento";
import type { EventoDoc } from "@/lib/types";

async function api<T>(init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const resposta = await fetch("/api/eventos/ausencias", {
    ...init,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as T & { error?: string };
  if (!resposta.ok) throw new Error(corpo.error || "Não foi possível concluir agora.");
  return corpo;
}

export type SituacaoResposta = "confirmado" | "nao-vai" | "sem-resposta";

/**
 * Respostas do atleta aos eventos: confirmar (no próprio evento) ou avisar que
 * não vai, com motivo (pela API, que guarda o motivo longe dos outros atletas).
 */
export function useRespostasEventos() {
  const { atleta, isPreview } = useAthleteView();
  const { show } = useToast();
  const [ausencias, setAusencias] = useState<Map<string, AusenciaEvento>>(new Map());
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  useEffect(() => {
    if (isPreview) return;
    let ativo = true;
    api<{ ausencias: AusenciaEvento[] }>()
      .then((r) => {
        if (ativo) setAusencias(new Map(r.ausencias.map((a) => [a.eventoId, a])));
      })
      .catch(() => undefined); // Sem os avisos, a tela segue com confirmar/cancelar.
    return () => {
      ativo = false;
    };
  }, [isPreview, atleta.id]);

  const situacao = useCallback(
    (evento: EventoDoc): SituacaoResposta =>
      evento.inscritos?.includes(atleta.id) ? "confirmado" : ausencias.has(evento.id) ? "nao-vai" : "sem-resposta",
    [atleta.id, ausencias],
  );

  async function confirmar(evento: EventoDoc) {
    if (isPreview) return;
    setAlterandoId(evento.id);
    try {
      await updateDoc(doc(db, "agenda_eventos", evento.id), { inscritos: arrayUnion(atleta.id) });
      if (ausencias.has(evento.id)) {
        await api({ method: "DELETE", body: JSON.stringify({ eventoId: evento.id }) }).catch(() => undefined);
        setAusencias((atual) => {
          const novo = new Map(atual);
          novo.delete(evento.id);
          return novo;
        });
      }
      show("success", "Presença confirmada!");
    } catch {
      show("error", "Não foi possível confirmar agora. Tente novamente.");
    } finally {
      setAlterandoId(null);
    }
  }

  async function avisarQueNaoVai(evento: EventoDoc, motivo: MotivoAusenciaEvento, detalhe: string) {
    await api({ method: "POST", body: JSON.stringify({ eventoId: evento.id, motivo, detalhe }) });
    setAusencias((atual) =>
      new Map(atual).set(evento.id, { eventoId: evento.id, atletaId: atleta.id, motivo, detalhe, em: new Date().toISOString() }),
    );
    show("success", "Aviso enviado ao comitê. Obrigado por avisar!");
  }

  return { ausencias, situacao, confirmar, avisarQueNaoVai, alterandoId, somenteVisualizacao: isPreview };
}

type Respostas = ReturnType<typeof useRespostasEventos>;

/** Botões "Vou / Não vou" de um evento, já com o aviso de ausência. */
export function RespostaEvento({
  evento,
  respostas,
  className,
  compacto = false,
}: {
  evento: EventoDoc;
  respostas: Respostas;
  className?: string;
  /** Uma coluna (cards estreitos e o modal do Início). */
  compacto?: boolean;
}) {
  const [perguntando, setPerguntando] = useState(false);
  const situacao = respostas.situacao(evento);
  const ausencia = respostas.ausencias.get(evento.id);
  const alterando = respostas.alterandoId === evento.id;
  const bloqueado = respostas.alterandoId !== null && !alterando;
  // Curto e igual para evento e reunião: cabe ao lado do "Não vou" no celular.
  const rotuloVou = "Vou participar";

  if (respostas.somenteVisualizacao) {
    return (
      <Button size="sm" variant="ghost" disabled className={cn("w-full sm:w-auto", className)}>
        Somente visualização
      </Button>
    );
  }

  return (
    <>
      {situacao === "nao-vai" && ausencia ? (
        <div className={cn("flex flex-col gap-2", !compacto && "sm:flex-row sm:items-center", className)}>
          <p className="flex min-h-9 min-w-0 flex-1 items-start gap-2 py-1 text-sm text-text-light">
            <CircleSlash className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">
              Você avisou que não vai · <span className="text-text">{textoAusencia(ausencia)}</span>
            </span>
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={alterando}
            disabled={bloqueado}
            onClick={() => respostas.confirmar(evento)}
            className={cn("w-full shrink-0", !compacto && "sm:w-auto")}
          >
            Mudei de ideia, vou
          </Button>
        </div>
      ) : situacao === "confirmado" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={bloqueado || alterando}
          onClick={() => setPerguntando(true)}
          className={cn("w-full shrink-0", !compacto && "sm:w-auto", className)}
        >
          Não vou mais
        </Button>
      ) : (
        <div className={cn("grid grid-cols-2 gap-2", !compacto && "sm:flex sm:w-auto", className)}>
          <Button size="sm" variant="secondary" disabled={bloqueado || alterando} onClick={() => setPerguntando(true)}>
            Não vou
          </Button>
          <Button size="sm" loading={alterando} disabled={bloqueado} onClick={() => respostas.confirmar(evento)}>
            <Check className="size-4" aria-hidden="true" />
            {rotuloVou}
          </Button>
        </div>
      )}

      {perguntando ? (
        <NaoVouModal
          evento={evento}
          inicial={ausencia}
          onClose={() => setPerguntando(false)}
          onEnviar={async (motivo, detalhe) => {
            await respostas.avisarQueNaoVai(evento, motivo, detalhe);
            setPerguntando(false);
          }}
        />
      ) : null}
    </>
  );
}

function NaoVouModal({
  evento,
  inicial,
  onClose,
  onEnviar,
}: {
  evento: EventoDoc;
  inicial?: AusenciaEvento;
  onClose: () => void;
  onEnviar: (motivo: MotivoAusenciaEvento, detalhe: string) => Promise<void>;
}) {
  const idDetalhe = useId();
  const idErro = useId();
  const [motivo, setMotivo] = useState<MotivoAusenciaEvento | null>(inicial?.motivo ?? null);
  const [detalhe, setDetalhe] = useState(inicial?.detalhe ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const r = validarAusenciaEvento({ motivo, detalhe });
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onEnviar(r.motivo, r.detalhe);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={ehReuniao(evento) ? "Não vai à reunião?" : "Não vai ao evento?"}
      description={evento.titulo}
      size="sm"
      mobileSheet
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Voltar
          </Button>
          <Button onClick={enviar} loading={enviando}>
            Avisar o comitê
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2" aria-describedby={erro ? idErro : undefined}>
          <legend className="mb-2 text-sm font-semibold text-text">Qual o motivo?</legend>
          <div className="grid grid-cols-2 gap-2">
            {MOTIVOS_AUSENCIA_EVENTO.map((m) => {
              const ativo = motivo === m.value;
              return (
                <label
                  key={m.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius)] border px-3 text-sm font-medium transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                    m.value === "outro" && "col-span-2",
                    ativo ? "border-primary bg-primary-subtle text-text" : "border-border text-text-secondary hover:bg-bg-inset",
                  )}
                >
                  <input
                    type="radio"
                    name="motivo-ausencia"
                    value={m.value}
                    checked={ativo}
                    onChange={() => {
                      setMotivo(m.value);
                      setErro(null);
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      ativo ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {ativo ? <span className="size-1.5 rounded-full bg-white" /> : null}
                  </span>
                  {m.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={idDetalhe} className="text-sm font-semibold text-text">
            {motivo === "outro" ? "Conte o motivo" : "Quer detalhar?"}{" "}
            {motivo === "outro" ? null : <span className="font-normal text-text-muted">(opcional)</span>}
          </label>
          <textarea
            id={idDetalhe}
            value={detalhe}
            onChange={(e) => {
              setDetalhe(e.target.value.slice(0, DETALHE_MAXIMO));
              setErro(null);
            }}
            rows={2}
            maxLength={DETALHE_MAXIMO}
            placeholder="Ex.: plantão no trabalho nesse dia"
            className="w-full resize-none rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
          />
        </div>

        {erro ? (
          <p id={idErro} role="alert" className="text-sm font-medium text-danger">
            {erro}
          </p>
        ) : null}

        <p className="flex items-start gap-2 text-xs text-text-light">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Só o comitê vê o motivo. Se mudar de ideia, é só confirmar depois.
        </p>
      </div>
    </Modal>
  );
}
