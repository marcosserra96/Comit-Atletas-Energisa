"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatShortDate } from "@/lib/format";

export interface LinhaImportacao {
  numeroLinha: number;
  atletaId: string;
  atletaNome: string;
  regraDesc: string;
  pontos: number;
  data: string;
}

export interface LinhaDuplicada extends LinhaImportacao {
  motivo: string;
}

export interface LinhaErro {
  numeroLinha: number;
  motivo: string;
}

export interface ResultadoAnalise {
  validas: LinhaImportacao[];
  duplicadas: LinhaDuplicada[];
  erros: LinhaErro[];
}

export function RevisarImportacaoModal({
  resultado,
  onCancelar,
  onConfirmar,
  confirmando,
}: {
  resultado: ResultadoAnalise | null;
  onCancelar: () => void;
  onConfirmar: (duplicadasSelecionadas: LinhaDuplicada[]) => void;
  confirmando: boolean;
}) {
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());

  const duplicadas = resultado?.duplicadas ?? [];
  const erros = resultado?.erros ?? [];
  const validas = resultado?.validas ?? [];

  const totalImportar = useMemo(
    () => validas.length + selecionadas.size,
    [validas.length, selecionadas],
  );

  function toggle(numeroLinha: number) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(numeroLinha)) next.delete(numeroLinha);
      else next.add(numeroLinha);
      return next;
    });
  }

  function marcarTodas(marcar: boolean) {
    setSelecionadas(marcar ? new Set(duplicadas.map((d) => d.numeroLinha)) : new Set());
  }

  function handleConfirmar() {
    onConfirmar(duplicadas.filter((d) => selecionadas.has(d.numeroLinha)));
  }

  return (
    <Modal
      open={resultado !== null}
      onClose={onCancelar}
      title="Revisar importação"
      description="Confira antes de confirmar — nada é gravado até você clicar em importar."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancelar} disabled={confirmando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} loading={confirmando} disabled={totalImportar === 0}>
            Confirmar importação ({totalImportar})
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success">
            <CheckCircle2 className="size-3.5" />
            {validas.length} pronto{validas.length === 1 ? "" : "s"} para importar
          </span>
          {duplicadas.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-xs font-bold text-[#a3790a]">
              <Copy className="size-3.5" />
              {duplicadas.length} possível{duplicadas.length === 1 ? "" : "eis"} duplicata
              {duplicadas.length === 1 ? "" : "s"}
            </span>
          )}
          {erros.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger">
              <XCircle className="size-3.5" />
              {erros.length} linha{erros.length === 1 ? "" : "s"} com erro
            </span>
          )}
        </div>

        {duplicadas.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold text-text">
                <AlertTriangle className="size-4 text-warning" />
                Possíveis duplicatas — desmarcadas por padrão
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => marcarTodas(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Marcar todas
                </button>
                <span className="text-xs text-text-muted">·</span>
                <button
                  onClick={() => marcarTodas(false)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-[var(--radius)] border border-border">
              {duplicadas.map((d) => (
                <label
                  key={d.numeroLinha}
                  className="flex cursor-pointer items-start gap-2.5 border-b border-border p-3 text-sm last:border-0 hover:bg-bg"
                >
                  <input
                    type="checkbox"
                    checked={selecionadas.has(d.numeroLinha)}
                    onChange={() => toggle(d.numeroLinha)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {d.atletaNome} · {formatShortDate(d.data)} · {d.regraDesc}
                    </p>
                    <p className="text-xs text-text-muted">{d.motivo}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {erros.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-bold text-text">
              <XCircle className="size-4 text-danger" />
              Linhas com erro — não serão importadas
            </p>
            <div className="max-h-56 overflow-y-auto rounded-[var(--radius)] border border-border">
              {erros.map((e) => (
                <div
                  key={e.numeroLinha}
                  className="border-b border-border p-3 text-sm last:border-0"
                >
                  <span className="font-semibold text-text">Linha {e.numeroLinha}:</span>{" "}
                  <span className="text-text-light">{e.motivo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
