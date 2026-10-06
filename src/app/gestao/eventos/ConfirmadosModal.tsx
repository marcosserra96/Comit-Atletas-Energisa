"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, MapPin, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SportBadge } from "@/components/ui/SportBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { exportToExcel } from "@/lib/excel";
import { formatShortDate } from "@/lib/format";
import { modalidadeFromEquipe, modalidadeLabel } from "@/lib/labels";
import { auth } from "@/lib/firebase";
import { motivoAusenciaEventoLabel, type AusenciaEvento } from "@/lib/ausenciasEvento";
import type { AtletaDoc, EventoDoc } from "@/lib/types";

type Aba = "confirmados" | "nao-vao" | "pendentes";

interface Pessoa {
  id: string;
  nome: string;
  modalidade: "corrida" | "bicicleta" | null;
  /** Só em "Não vão". */
  motivo?: string;
  detalhe?: string;
}

/** Quem avisou que não vai (o motivo fica numa coleção só do servidor). */
function useAusencias(eventoId: string | null) {
  const [estado, setEstado] = useState<{ id: string; lista: AusenciaEvento[] | null; erro: boolean } | null>(null);
  useEffect(() => {
    if (!eventoId) return;
    let ativo = true;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error();
        const r = await fetch(`/api/eventos/ausencias?evento=${encodeURIComponent(eventoId)}`, {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        if (!r.ok) throw new Error();
        const corpo = (await r.json()) as { ausencias: AusenciaEvento[] };
        if (ativo) setEstado({ id: eventoId, lista: corpo.ausencias, erro: false });
      } catch {
        if (ativo) setEstado({ id: eventoId, lista: [], erro: true });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [eventoId]);
  return estado && estado.id === eventoId ? estado : { lista: null, erro: false };
}

function nomeDoArquivo(evento: EventoDoc) {
  const base = evento.titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `confirmados-${base || "evento"}.xlsx`;
}

/**
 * Quem confirmou presença num evento e, entre os atletas ativos da
 * modalidade do evento, quem ainda não confirmou.
 */
export function ConfirmadosModal({
  open,
  evento,
  atletas,
  onClose,
}: {
  open: boolean;
  evento: EventoDoc | null;
  /** `null` enquanto carrega. */
  atletas: AtletaDoc[] | null;
  onClose: () => void;
}) {
  const [aba, setAba] = useState<Aba>("confirmados");
  const ausencias = useAusencias(open && evento ? evento.id : null);

  const { confirmados, naoVao, pendentes } = useMemo(() => {
    if (!evento) return { confirmados: [] as Pessoa[], naoVao: [] as Pessoa[], pendentes: [] as Pessoa[] };
    const porId = new Map((atletas ?? []).map((a) => [a.id, a]));
    const inscritos = new Set(evento.inscritos ?? []);
    const ordenar = (lista: Pessoa[]) => lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const confirmados = ordenar(
      [...inscritos].map((id) => {
        const atleta = porId.get(id);
        return {
          id,
          nome: atleta?.nome ?? "Atleta sem cadastro",
          modalidade: atleta ? modalidadeFromEquipe(atleta.equipe) : null,
        };
      }),
    );

    // Confirmou depois de avisar? Vale a confirmação.
    const avisos = (ausencias.lista ?? []).filter((a) => !inscritos.has(a.atletaId));
    const ausentes = new Set(avisos.map((a) => a.atletaId));
    const naoVao = ordenar(
      avisos.map((a) => {
        const atleta = porId.get(a.atletaId);
        return {
          id: a.atletaId,
          nome: atleta?.nome ?? "Atleta sem cadastro",
          modalidade: atleta ? modalidadeFromEquipe(atleta.equipe) : null,
          motivo: motivoAusenciaEventoLabel[a.motivo] ?? "Outro motivo",
          detalhe: a.detalhe,
        };
      }),
    );

    const pendentes = ordenar(
      (atletas ?? [])
        .filter((a) => {
          if (inscritos.has(a.id) || ausentes.has(a.id) || !a.ativo || a.visivelNasListas === false) return false;
          // Só quem está de fato no programa (fila de espera fica de fora).
          if (a.equipe !== "corrida" && a.equipe !== "bicicleta") return false;
          return evento.modalidade === "ambas" || evento.modalidade === a.equipe;
        })
        .map((a) => ({ id: a.id, nome: a.nome, modalidade: modalidadeFromEquipe(a.equipe) })),
    );

    return { confirmados, naoVao, pendentes };
  }, [evento, atletas, ausencias.lista]);

  const lista = aba === "confirmados" ? confirmados : aba === "nao-vao" ? naoVao : pendentes;
  const carregando = atletas === null || (aba !== "confirmados" && ausencias.lista === null);

  function exportar() {
    if (!evento) return;
    void exportToExcel(
      nomeDoArquivo(evento),
      "Respostas",
      [
        ...confirmados.map((p) => ({ ...p, resposta: "Vai" })),
        ...naoVao.map((p) => ({ ...p, resposta: "Não vai" })),
      ].map((p) => ({
        Atleta: p.nome,
        Modalidade: p.modalidade ? modalidadeLabel[p.modalidade] : "",
        Resposta: p.resposta,
        Motivo: p.motivo ?? "",
        Detalhe: p.detalhe ?? "",
        Evento: evento.titulo,
        Data: formatShortDate(evento.data),
        Local: evento.local,
      })),
    );
  }

  return (
    <Modal
      open={open && !!evento}
      onClose={onClose}
      title="Respostas dos atletas"
      size="md"
      mobileSheet
    >
      {evento && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-semibold text-text">{evento.titulo}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-light">
              <span className="font-medium text-text-secondary">{formatShortDate(evento.data)}</span>
              <span aria-hidden>·</span>
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{evento.local}</span>
            </p>
          </div>

          <SegmentedControl
            value={aba}
            onChange={setAba}
            className="w-full [&>button]:flex-1 [&>button]:whitespace-nowrap"
            options={[
              { value: "confirmados", label: `Vão (${confirmados.length})` },
              { value: "nao-vao", label: `Não vão (${ausencias.lista === null ? "…" : naoVao.length})` },
              { value: "pendentes", label: `Sem resposta (${atletas === null || ausencias.lista === null ? "…" : pendentes.length})` },
            ]}
          />

          {aba === "nao-vao" && ausencias.erro ? (
            <p className="rounded-[var(--radius)] bg-bg-inset p-3 text-sm text-text-light">
              Não foi possível carregar os avisos de ausência agora. Feche e abra de novo.
            </p>
          ) : null}

          {carregando ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-[var(--radius)] bg-bg-subtle" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                aba === "confirmados" ? "Ninguém confirmou ainda" : aba === "nao-vao" ? "Ninguém avisou que não vai" : "Todos responderam"
              }
              description={
                aba === "confirmados"
                  ? "As confirmações aparecem aqui assim que os atletas responderem."
                  : aba === "nao-vao"
                    ? "Quando um atleta disser que não vai, o motivo aparece aqui."
                    : "Todos os atletas ativos desta modalidade já responderam."
              }
            />
          ) : (
            <ul className="-mx-1 flex max-h-[50vh] flex-col overflow-y-auto">
              {lista.map((p, i) => (
                <li
                  key={p.id}
                  className="flex min-h-11 items-center justify-between gap-3 border-b border-border-subtle px-1 py-2 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-text-muted">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text">{p.nome}</span>
                      {p.motivo ? (
                        <span className="block text-xs text-text-light">
                          <span className="font-semibold text-text-secondary">{p.motivo}</span>
                          {p.detalhe ? ` · ${p.detalhe}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {evento.modalidade === "ambas" && p.modalidade && (
                    <SportBadge modalidade={p.modalidade} size="sm" />
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" variant="secondary" onClick={exportar} disabled={confirmados.length === 0 && naoVao.length === 0}>
              <FileSpreadsheet className="size-4" />
              Exportar respostas
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
