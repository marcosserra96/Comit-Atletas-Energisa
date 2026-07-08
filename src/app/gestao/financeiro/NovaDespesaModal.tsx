"use client";

import { FormEvent, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CategoriaDespesa, DespesaDoc } from "@/lib/types";

const CATEGORIAS: CategoriaDespesa[] = [
  "Provas / Inscrições",
  "Mensalidade Treinador",
  "Encontros e Eventos",
  "Uniformes e Materiais",
  "Outros",
];

const TIPOS_CUSTO = [
  { chave: "Insc", label: "Inscrição" },
  { chave: "Transp", label: "Transporte" },
  { chave: "Hosp", label: "Hospedagem" },
  { chave: "Alim", label: "Alimentação" },
  { chave: "Demais", label: "Outros" },
] as const;

export function NovaDespesaModal({
  open,
  onClose,
  despesa,
  empresasConhecidas = [],
}: {
  open: boolean;
  onClose: () => void;
  despesa?: DespesaDoc | null;
  empresasConhecidas?: string[];
}) {
  const { show } = useToast();
  const [categoria, setCategoria] = useState<CategoriaDespesa>(despesa?.categoria ?? "Provas / Inscrições");
  const [equipe, setEquipe] = useState(despesa?.equipe ?? "Corrida e Bike");
  const [evento, setEvento] = useState(despesa?.evento ?? "");
  const [empresaPagadora, setEmpresaPagadora] = useState(despesa?.empresaPagadora ?? "");
  const [avulso, setAvulso] = useState(despesa?.avulso ?? false);
  const [observacoes, setObservacoes] = useState(despesa?.observacoes ?? "");
  const [prop, setProp] = useState<Record<string, number>>({
    Insc: despesa?.propInsc ?? 0,
    Transp: despesa?.propTransp ?? 0,
    Hosp: despesa?.propHosp ?? 0,
    Alim: despesa?.propAlim ?? 0,
    Demais: despesa?.propDemais ?? 0,
  });
  const [real, setReal] = useState<Record<string, number>>({
    Insc: despesa?.realInsc ?? 0,
    Transp: despesa?.realTransp ?? 0,
    Hosp: despesa?.realHosp ?? 0,
    Alim: despesa?.realAlim ?? 0,
    Demais: despesa?.realDemais ?? 0,
  });
  const [loading, setLoading] = useState(false);

  const totalProposto = avulso ? 0 : TIPOS_CUSTO.reduce((s, t) => s + prop[t.chave], 0);
  const totalRealizado = TIPOS_CUSTO.reduce((s, t) => s + real[t.chave], 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!evento.trim()) {
      show("info", "Informe o título / evento relacionado.");
      return;
    }
    setLoading(true);
    try {
      const dados = {
        categoria,
        equipe,
        evento: evento.trim(),
        empresaPagadora: empresaPagadora.trim(),
        avulso,
        ...(avulso
          ? {}
          : {
              propInsc: prop.Insc,
              propTransp: prop.Transp,
              propHosp: prop.Hosp,
              propAlim: prop.Alim,
              propDemais: prop.Demais,
            }),
        realInsc: real.Insc,
        realTransp: real.Transp,
        realHosp: real.Hosp,
        realAlim: real.Alim,
        realDemais: real.Demais,
        totalProposto,
        totalRealizado,
        observacoes: observacoes.trim(),
      };
      if (despesa) {
        await setDoc(doc(db, "despesas", despesa.id), { ...dados, atualizadoEm: serverTimestamp() }, { merge: true });
        show("success", "Despesa atualizada.");
      } else {
        const nova = doc(collection(db, "despesas"));
        await setDoc(nova, { id: nova.id, ...dados, criadoEm: serverTimestamp() });
        show("success", "Despesa registrada.");
      }
      onClose();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const desvio = totalProposto - totalRealizado;

  return (
    <Modal open={open} onClose={onClose} title={despesa ? "Editar despesa" : "Nova despesa"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Categoria</label>
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDespesa)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Equipe</label>
            <Select value={equipe} onChange={(e) => setEquipe(e.target.value)}>
              <option value="Corrida e Bike">Corrida e Bike</option>
              <option value="Corrida">Corrida</option>
              <option value="Bike">Bike</option>
            </Select>
          </div>
          <TextField
            label="Evento / título do custo"
            placeholder="Ex: Circuito das Estações — Etapa 1"
            value={evento}
            onChange={(e) => setEvento(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Empresa pagadora</label>
          <input
            list="empresas-pagadoras"
            value={empresaPagadora}
            onChange={(e) => setEmpresaPagadora(e.target.value)}
            placeholder="Ex: Energisa, Comitê, patrocinador…"
            className="h-11 w-full rounded-[var(--radius)] border border-border bg-bg px-3.5 text-sm text-text outline-none placeholder:text-text-muted transition-colors focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15"
          />
          <datalist id="empresas-pagadoras">
            {empresasConhecidas.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
          <p className="text-xs text-text-muted">
            Digite livremente — se for uma empresa nova, ela fica disponível pra sugestão nos próximos lançamentos.
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-text">
          <input
            type="checkbox"
            checked={avulso}
            onChange={(e) => setAvulso(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          Lançamento avulso (não estava no orçamento previsto)
        </label>

        {/* Tabela lado a lado — telas sm e maiores */}
        <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border sm:block">
          <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-px bg-border text-xs font-bold uppercase tracking-wide text-text-muted">
            <div className="bg-bg-card px-3 py-2">Tipo de custo</div>
            <div className="bg-bg-card px-3 py-2 text-center">Orçado</div>
            <div className="bg-bg-card px-3 py-2 text-center text-secondary">Realizado</div>
          </div>
          {TIPOS_CUSTO.map((t) => (
            <div key={t.chave} className="grid grid-cols-[1.3fr_1fr_1fr] gap-px bg-border">
              <div className="flex items-center bg-bg-card px-3 py-2 text-sm font-medium text-text">{t.label}</div>
              <div className={cn("bg-bg-card px-2 py-1.5", avulso && "pointer-events-none opacity-30")}>
                <CustoInput
                  value={prop[t.chave]}
                  onChange={(v) => setProp((p) => ({ ...p, [t.chave]: v }))}
                  disabled={avulso}
                />
              </div>
              <div className="bg-bg-card px-2 py-1.5">
                <CustoInput value={real[t.chave]} onChange={(v) => setReal((p) => ({ ...p, [t.chave]: v }))} />
              </div>
            </div>
          ))}
        </div>

        {/* Cartões empilhados — telas menores que sm */}
        <div className="flex flex-col gap-2 sm:hidden">
          {TIPOS_CUSTO.map((t) => (
            <div key={t.chave} className="rounded-[var(--radius)] border border-border bg-bg-card p-3">
              <p className="mb-2 text-sm font-semibold text-text">{t.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={avulso ? "pointer-events-none opacity-30" : undefined}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">Orçado</p>
                  <CustoInput
                    value={prop[t.chave]}
                    onChange={(v) => setProp((p) => ({ ...p, [t.chave]: v }))}
                    disabled={avulso}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-secondary">Realizado</p>
                  <CustoInput value={real[t.chave]} onChange={(v) => setReal((p) => ({ ...p, [t.chave]: v }))} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-[var(--radius)] border border-border bg-bg p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-text-light">Total orçado</p>
            <p className="text-lg font-extrabold text-text">{formatBRL(totalProposto)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-light">Total realizado</p>
            <p className="text-lg font-extrabold text-secondary">{formatBRL(totalRealizado)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-light">Desvio</p>
            <p className={cn("text-lg font-extrabold", desvio < 0 ? "text-danger" : "text-success")}>
              {formatBRL(desvio)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Observações (opcional)</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Alguma informação adicional sobre este lançamento…"
            rows={3}
            className="w-full resize-none rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {despesa ? "Salvar alterações" : "Registrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CustoInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, "");
    const centavos = digitos ? parseInt(digitos, 10) : 0;
    onChange(centavos / 100);
  }

  const exibicao = value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  return (
    <div className="flex items-center rounded-[var(--radius-sm)] border border-border bg-bg px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
      <span className="text-xs text-text-muted">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={exibicao}
        onChange={handleChange}
        disabled={disabled}
        placeholder="0,00"
        className="h-9 w-full min-w-0 bg-transparent px-1.5 text-right text-sm text-text outline-none placeholder:text-text-muted"
      />
    </div>
  );
}
