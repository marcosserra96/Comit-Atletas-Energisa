"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { dataIsoLocal } from "@/lib/date";
import { formatPontos } from "@/lib/format";
import { camposEditaveis, criteriosParaEdicao, resumirMudancas, type MudancasLancamento } from "@/lib/extrato";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import type { HistoricoPontoDoc, RegraPontuacaoDoc } from "@/lib/types";

const areaTexto =
  "w-full rounded-[var(--radius)] border border-border bg-bg-card px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

function kmDoTexto(texto: string) {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

/** Corrige um lançamento no lugar: critério (e os pontos dele), data, km e observação. */
export function EditarLancamentoModal({
  lancamento,
  regras,
  onClose,
  onSalvar,
}: {
  lancamento: HistoricoPontoDoc | null;
  regras: RegraPontuacaoDoc[];
  onClose: () => void;
  onSalvar: (mudancas: MudancasLancamento, motivo: string) => Promise<void>;
}) {
  return (
    <Modal open={!!lancamento} onClose={onClose} mobileSheet title="Editar lançamento" description={lancamento ? lancamento.atletaNome : undefined}>
      {lancamento ? <Formulario key={lancamento.id} lancamento={lancamento} regras={regras} onClose={onClose} onSalvar={onSalvar} /> : null}
    </Modal>
  );
}

function Formulario({
  lancamento: l,
  regras,
  onClose,
  onSalvar,
}: {
  lancamento: HistoricoPontoDoc;
  regras: RegraPontuacaoDoc[];
  onClose: () => void;
  onSalvar: (mudancas: MudancasLancamento, motivo: string) => Promise<void>;
}) {
  const pode = camposEditaveis(l);
  const criterios = useMemo(() => criteriosParaEdicao(regras, l), [regras, l]);
  const [regraId, setRegraId] = useState(l.regraId);
  const [data, setData] = useState(l.dataTreino);
  const [km, setKm] = useState(l.kmPercorrido ? String(l.kmPercorrido).replace(".", ",") : "");
  const [observacao, setObservacao] = useState(l.observacao ?? "");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const idObs = useId();
  const idMotivo = useId();

  const criterio = criterios.find((c) => c.id === regraId);
  // Trocar o critério leva os pontos dele; manter o critério mantém os pontos lançados.
  const pontos = regraId === l.regraId ? l.pontos : (criterio?.pontos ?? l.pontos);
  const kmNumero = km.trim() ? kmDoTexto(km) : 0;
  const kmInvalido = Number.isNaN(kmNumero);
  const dataInvalida = !data || data > dataIsoLocal();
  const mudancas: MudancasLancamento = {
    ...(pode.criterio ? { regraId, regraDesc: criterio?.descricao ?? l.regraDesc, pontos } : {}),
    ...(pode.data ? { dataTreino: data } : {}),
    ...(pode.km && !kmInvalido ? { kmPercorrido: kmNumero } : {}),
    ...(pode.observacao ? { observacao } : {}),
  };
  const { resumo, vazio } = resumirMudancas(l, mudancas);

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar(mudancas, motivo);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!vazio && !kmInvalido && !dataInvalida) void salvar();
      }}
    >
      {pode.aviso ? (
        <p className="flex items-start gap-2 rounded-[var(--radius)] bg-bg-inset px-3 py-2.5 text-sm text-text-light">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {pode.aviso}
        </p>
      ) : null}
      {pode.criterio ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Critério</span>
          <Select value={regraId} onChange={(e) => setRegraId(e.target.value)} searchable={criterios.length > 8}>
            {criterios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao} · {formatPontos(c.pontos)} pts
              </option>
            ))}
          </Select>
          {pontos !== l.pontos ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
              Pontos: <span className="tabular-nums text-text-light line-through">{formatPontos(l.pontos)}</span>
              <ArrowRight className="size-3.5 text-text-muted" aria-hidden="true" />
              <span className="tabular-nums text-success">{formatPontos(pontos)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {pode.data || pode.km ? (
        <div className="grid grid-cols-2 gap-3">
          {pode.data ? (
            <TextField
              label="Data do treino"
              type="date"
              value={data}
              max={dataIsoLocal()}
              onChange={(e) => setData(e.target.value)}
              error={dataInvalida ? "Escolha uma data até hoje." : undefined}
            />
          ) : null}
          {pode.km ? (
            <TextField
              label="Km"
              inputMode="decimal"
              placeholder="Sem km"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              error={kmInvalido ? "Use só números (ex.: 7,5)." : undefined}
            />
          ) : null}
        </div>
      ) : null}
      {pode.observacao ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idObs} className="text-sm font-medium text-text">
            Observação <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <textarea id={idObs} rows={2} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={areaTexto} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idMotivo} className="text-sm font-medium text-text">
          Motivo da correção <span className="font-normal text-text-muted">(opcional, fica no histórico)</span>
        </label>
        <input
          id={idMotivo}
          value={motivo}
          maxLength={200}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex: data lançada errada"
          className={`${areaTexto} h-11 py-0`}
        />
      </div>
      <p className="min-h-5 text-xs text-text-light" aria-live="polite">
        {vazio ? "Nada mudou ainda." : `Vai mudar: ${resumo}`}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={salvando} disabled={vazio || kmInvalido || dataInvalida}>
          Salvar correção
        </Button>
      </div>
    </form>
  );
}
