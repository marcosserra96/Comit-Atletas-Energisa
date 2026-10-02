"use client";

import { FormEvent, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Link as LinkIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { regraContaComoTreino } from "@/lib/activityConsolidation";
import { recalcularRankingPorCriterio } from "@/lib/rankingAutoUpdate";
import type { RegraPontuacaoDoc, TipoLancamento } from "@/lib/types";

const tipos: { value: TipoLancamento; label: string }[] = [
  { value: "treino", label: "Treino" },
  { value: "evento", label: "Evento" },
  { value: "avulso", label: "Avulso" },
];

export function NovaRegraModal({
  open,
  onClose,
  regra,
  todasRegras,
}: {
  open: boolean;
  onClose: () => void;
  regra: RegraPontuacaoDoc | null;
  todasRegras: RegraPontuacaoDoc[];
}) {
  const { show } = useToast();
  const [descricao, setDescricao] = useState(regra?.descricao ?? "");
  const [modalidade, setModalidade] = useState<"ambas" | "corrida" | "bicicleta">(
    regra?.modalidade ?? "ambas",
  );
  const [pontos, setPontos] = useState(String(regra?.pontos ?? ""));
  const [tiposSelecionados, setTiposSelecionados] = useState<Set<TipoLancamento>>(
    new Set(regra?.tiposLancamento ?? ["treino"]),
  );
  const [excludentes, setExcludentes] = useState<Set<string>>(
    new Set(regra?.regrasExcludentes ?? []),
  );
  const [contaComoTreino, setContaComoTreino] = useState(regra ? regraContaComoTreino(regra) : true);
  const [loading, setLoading] = useState(false);
  // Lançado como Treino sempre conta; a opção só decide para Avulso.
  const valeComoTreino = tiposSelecionados.has("treino");

  function toggleTipo(tipo: TipoLancamento) {
    setTiposSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }

  function toggleExcludente(id: string) {
    setExcludentes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const outrasRegras = todasRegras.filter((r) => r.id !== regra?.id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (tiposSelecionados.size === 0) {
      show("info", "Selecione ao menos um tipo de lançamento.");
      return;
    }
    setLoading(true);
    try {
      const ref = regra ? doc(db, "regras_pontuacao", regra.id) : doc(collection(db, "regras_pontuacao"));
      const contaAgora = valeComoTreino || contaComoTreino;
      // Critério novo ainda não tem lançamentos; um existente que mudou muda as contagens.
      const mudouContagem = regra ? regraContaComoTreino(regra) !== contaAgora : false;
      await setDoc(ref, {
        id: ref.id,
        descricao,
        modalidade,
        pontos: Math.round(Number(pontos)),
        tiposLancamento: [...tiposSelecionados],
        regrasExcludentes: [...excludentes],
        contaComoTreino: contaAgora,
        criadoEm: regra?.criadoEm ?? serverTimestamp(),
      });
      onClose();
      if (mudouContagem) {
        show("info", "Regra atualizada. Recalculando o ranking com a nova contagem de treinos…");
        const ok = await recalcularRankingPorCriterio();
        show(
          ok ? "success" : "info",
          ok
            ? "Ranking recalculado com a nova contagem de treinos."
            : "Regra atualizada, mas o ranking não recalculou. Use \"Recalcular agora\" em Configurar portal.",
        );
      } else {
        show("success", regra ? "Regra atualizada." : "Regra criada.");
      }
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={regra ? "Editar regra" : "Nova regra"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Descrição"
          placeholder="Ex: Participação em treino"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Modalidade</label>
            <Select value={modalidade} onChange={(e) => setModalidade(e.target.value as typeof modalidade)}>
              <option value="ambas">Ambas</option>
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bike</option>
            </Select>
          </div>
          <TextField
            label="Pontos"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={pontos}
            onChange={(e) => setPontos(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Tipos de lançamento em que vale</label>
          <div className="flex flex-wrap gap-3">
            {tipos.map((t) => (
              <label key={t.value} className="flex items-center gap-1.5 text-sm text-text">
                <input
                  type="checkbox"
                  checked={tiposSelecionados.has(t.value)}
                  onChange={() => toggleTipo(t.value)}
                  className="size-4 rounded border-border accent-primary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <label
          className={
            "flex items-start gap-2.5 rounded-[var(--radius)] border border-border bg-bg p-3.5 text-sm " +
            (valeComoTreino ? "cursor-default" : "cursor-pointer")
          }
        >
          <input
            type="checkbox"
            checked={valeComoTreino || contaComoTreino}
            disabled={valeComoTreino}
            onChange={(e) => setContaComoTreino(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary disabled:opacity-60"
          />
          <span>
            <span className="font-semibold text-text">Conta como treino</span>
            <span className="mt-0.5 block text-xs text-text-light">
              {valeComoTreino
                ? "Lançamentos do tipo Treino sempre contam na quantidade de treinos e na aderência."
                : "Entra na quantidade de treinos e na aderência mesmo lançado como Avulso (ex.: treino avulso, treino extra). Desmarque para ajustes e bônus."}
            </span>
          </span>
        </label>
        <div className="rounded-[var(--radius)] border border-accent/25 bg-accent/5 p-3.5">
          <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-accent">
            <LinkIcon className="size-3.5" />
            Restrição de concorrência
          </label>
          <p className="mb-2.5 text-xs text-text-light">
            Regras que <b>não</b> podem ser pontuadas junto com esta, para o mesmo atleta no mesmo lançamento.
          </p>
          {outrasRegras.length === 0 ? (
            <p className="rounded-[var(--radius-sm)] border border-border bg-bg-card p-2.5 text-center text-xs text-text-muted">
              Cadastre outras regras para definir restrições.
            </p>
          ) : (
            <div className="flex max-h-[140px] flex-col gap-1.5 overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-bg-card p-2.5">
              {outrasRegras.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={excludentes.has(r.id)}
                    onChange={() => toggleExcludente(r.id)}
                    className="size-4 rounded border-border accent-accent"
                  />
                  {r.descricao}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {regra ? "Salvar" : "Criar regra"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
