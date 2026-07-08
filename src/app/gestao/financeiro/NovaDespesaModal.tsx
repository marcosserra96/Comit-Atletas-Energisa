"use client";

import { FormEvent, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Plus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatBRL } from "@/lib/format";
import { garantirEmpresaPagadora } from "@/lib/empresasPagadoras";
import { cn } from "@/lib/cn";
import type { CategoriaDespesa, DespesaDoc, EmpresaPagadoraDoc, ParcelaDespesa } from "@/lib/types";

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

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const NOVA_EMPRESA = "__nova__";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function parcelasIniciais(orcadoAnual: number): ParcelaDespesa[] {
  const porMes = Math.round((orcadoAnual / 12) * 100) / 100;
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    valorPrevisto: porMes,
    valorPago: 0,
    pago: false,
  }));
}

export function NovaDespesaModal({
  open,
  onClose,
  despesa,
  empresas = [],
}: {
  open: boolean;
  onClose: () => void;
  despesa?: DespesaDoc | null;
  empresas?: EmpresaPagadoraDoc[];
}) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const anoAtual = new Date().getFullYear();
  const [categoria, setCategoria] = useState<CategoriaDespesa>(despesa?.categoria ?? "Provas / Inscrições");
  const [equipe, setEquipe] = useState(despesa?.equipe ?? "Corrida e Bike");
  const [evento, setEvento] = useState(despesa?.evento ?? "");
  const [anoReferencia, setAnoReferencia] = useState(despesa?.anoReferencia ?? anoAtual);
  const [mesReferencia, setMesReferencia] = useState(despesa?.mesReferencia ?? 0);
  const [empresaPagadora, setEmpresaPagadora] = useState(despesa?.empresaPagadora ?? "");
  const [dividirEntreEmpresas, setDividirEntreEmpresas] = useState(!!despesa?.rateio?.length);
  const [rateio, setRateio] = useState<{ empresa: string; valor: number }[]>(
    despesa?.rateio?.length ? despesa.rateio : [{ empresa: "", valor: 0 }],
  );
  const [recorrente, setRecorrente] = useState(!!despesa?.recorrente);
  const [orcadoAnual, setOrcadoAnual] = useState(despesa?.totalProposto ?? 0);
  const [parcelas, setParcelas] = useState<ParcelaDespesa[]>(
    despesa?.parcelas?.length ? despesa.parcelas : parcelasIniciais(0),
  );
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

  const totalProposto = recorrente
    ? parcelas.reduce((s, p) => s + p.valorPrevisto, 0)
    : avulso
      ? 0
      : TIPOS_CUSTO.reduce((s, t) => s + prop[t.chave], 0);
  const totalRealizado = recorrente
    ? parcelas.reduce((s, p) => s + (p.pago ? p.valorPago : 0), 0)
    : TIPOS_CUSTO.reduce((s, t) => s + real[t.chave], 0);
  const somaRateio = rateio.reduce((s, r) => s + r.valor, 0);
  const rateioBate = Math.abs(somaRateio - totalRealizado) < 0.01;

  function atualizarRateio(i: number, patch: Partial<{ empresa: string; valor: number }>) {
    setRateio((r) => r.map((linha, idx) => (idx === i ? { ...linha, ...patch } : linha)));
  }

  function atualizarParcela(i: number, patch: Partial<ParcelaDespesa>) {
    setParcelas((p) => p.map((linha, idx) => (idx === i ? { ...linha, ...patch } : linha)));
  }

  function togglePago(i: number, pago: boolean) {
    atualizarParcela(i, { pago, dataPagamento: pago ? parcelas[i].dataPagamento || hoje() : parcelas[i].dataPagamento });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!evento.trim()) {
      show("info", "Informe o título / evento relacionado.");
      return;
    }
    if (!recorrente && dividirEntreEmpresas) {
      const linhasValidas = rateio.filter((r) => r.empresa.trim());
      if (linhasValidas.length === 0) {
        show("info", "Adicione ao menos uma empresa no rateio.");
        return;
      }
      if (!rateioBate) {
        show("info", `As fatias somam ${formatBRL(somaRateio)}, mas o realizado é ${formatBRL(totalRealizado)}.`);
        return;
      }
    }
    setLoading(true);
    try {
      const dados = {
        categoria,
        equipe,
        evento: evento.trim(),
        anoReferencia,
        mesReferencia: recorrente || !mesReferencia ? null : mesReferencia,
        empresaPagadora: recorrente || dividirEntreEmpresas ? "" : empresaPagadora.trim(),
        rateio: !recorrente && dividirEntreEmpresas ? rateio.filter((r) => r.empresa.trim()) : [],
        recorrente,
        parcelas: recorrente ? parcelas : [],
        avulso: recorrente ? false : avulso,
        ...(recorrente || avulso
          ? {}
          : {
              propInsc: prop.Insc,
              propTransp: prop.Transp,
              propHosp: prop.Hosp,
              propAlim: prop.Alim,
              propDemais: prop.Demais,
            }),
        ...(recorrente
          ? {}
          : {
              realInsc: real.Insc,
              realTransp: real.Transp,
              realHosp: real.Hosp,
              realAlim: real.Alim,
              realDemais: real.Demais,
            }),
        totalProposto,
        totalRealizado,
        observacoes: observacoes.trim(),
      };
      if (despesa) {
        await setDoc(
          doc(db, "despesas", despesa.id),
          { ...dados, atualizadoEm: serverTimestamp(), atualizadoPor: uid, atualizadoPorNome: autor.nome },
          { merge: true },
        );
        show("success", "Despesa atualizada.");
      } else {
        const nova = doc(collection(db, "despesas"));
        await setDoc(nova, {
          id: nova.id,
          ...dados,
          criadoEm: serverTimestamp(),
          criadoPor: uid,
          criadoPorNome: autor.nome,
        });
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

        <div className="grid grid-cols-2 gap-3 sm:w-1/2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Ano de referência</label>
            <Select value={String(anoReferencia)} onChange={(e) => setAnoReferencia(Number(e.target.value))}>
              {[anoAtual - 1, anoAtual, anoAtual + 1].map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </Select>
          </div>
          {!recorrente && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Mês (opcional)</label>
              <Select value={String(mesReferencia)} onChange={(e) => setMesReferencia(Number(e.target.value))}>
                <option value="0">Sem mês definido</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-text">
          <input
            type="checkbox"
            checked={recorrente}
            onChange={(e) => {
              setRecorrente(e.target.checked);
              if (e.target.checked && parcelas.every((p) => p.valorPrevisto === 0)) {
                setParcelas(parcelasIniciais(orcadoAnual));
              }
            }}
            className="size-4 rounded border-border accent-primary"
          />
          Custo recorrente, pago mês a mês (ex: mensalidade)
        </label>

        {recorrente ? (
          <ParcelasEditor
            orcadoAnual={orcadoAnual}
            onOrcadoAnualChange={setOrcadoAnual}
            onAplicarOrcado={() => setParcelas(parcelasIniciais(orcadoAnual))}
            parcelas={parcelas}
            onAtualizarParcela={atualizarParcela}
            onTogglePago={togglePago}
          />
        ) : (
          <>
            <label className="flex items-center gap-2.5 text-sm font-medium text-text">
              <input
                type="checkbox"
                checked={dividirEntreEmpresas}
                onChange={(e) => setDividirEntreEmpresas(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Dividir o valor realizado entre empresas (rateio)
            </label>

            {dividirEntreEmpresas ? (
              <div className="flex flex-col gap-2.5 rounded-[var(--radius)] border border-border bg-bg p-3">
                <p className="text-sm font-medium text-text">Rateio entre empresas</p>
                {rateio.map((linha, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <EmpresaCampo
                        value={linha.empresa}
                        empresas={empresas}
                        onChange={(nome) => atualizarRateio(i, { empresa: nome })}
                      />
                    </div>
                    <div className="w-32 shrink-0">
                      <CustoInput value={linha.valor} onChange={(v) => atualizarRateio(i, { valor: v })} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setRateio((r) => r.filter((_, idx) => idx !== i))}
                      disabled={rateio.length === 1}
                      aria-label="Remover empresa do rateio"
                      className="shrink-0 rounded-[var(--radius-sm)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => setRateio((r) => [...r, { empresa: "", valor: 0 }])}
                >
                  <Plus className="size-3.5" />
                  Adicionar empresa
                </Button>
                <p className={cn("text-xs", rateioBate ? "text-text-muted" : "font-semibold text-danger")}>
                  Fatias somam {formatBRL(somaRateio)} de {formatBRL(totalRealizado)} realizado
                  {!rateioBate && " — ajuste até bater."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text">Empresa pagadora</label>
                <EmpresaCampo value={empresaPagadora} empresas={empresas} onChange={setEmpresaPagadora} />
              </div>
            )}

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
          </>
        )}

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

        {despesa && (
          <p className="text-xs text-text-muted">
            Criado por {despesa.criadoPorNome || "—"}
            {despesa.atualizadoPorNome && ` · última edição de ${despesa.atualizadoPorNome}`}
          </p>
        )}

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

function ParcelasEditor({
  orcadoAnual,
  onOrcadoAnualChange,
  onAplicarOrcado,
  parcelas,
  onAtualizarParcela,
  onTogglePago,
}: {
  orcadoAnual: number;
  onOrcadoAnualChange: (v: number) => void;
  onAplicarOrcado: () => void;
  parcelas: ParcelaDespesa[];
  onAtualizarParcela: (i: number, patch: Partial<ParcelaDespesa>) => void;
  onTogglePago: (i: number, pago: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Orçado anual</label>
          <CustoInput value={orcadoAnual} onChange={onOrcadoAnualChange} />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onAplicarOrcado}>
          Dividir em 12 parcelas iguais
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[56px_1fr_64px_1fr_1fr] gap-px bg-border text-[10px] font-bold uppercase tracking-wide text-text-muted">
            <div className="bg-bg-card px-2 py-2">Mês</div>
            <div className="bg-bg-card px-2 py-2 text-center">Previsto</div>
            <div className="bg-bg-card px-2 py-2 text-center">Pago</div>
            <div className="bg-bg-card px-2 py-2 text-center text-secondary">Valor pago</div>
            <div className="bg-bg-card px-2 py-2 text-center">Data</div>
          </div>
          {parcelas.map((p, i) => (
            <div key={p.mes} className="grid grid-cols-[56px_1fr_64px_1fr_1fr] gap-px bg-border">
              <div className="flex items-center bg-bg-card px-2 py-1.5 text-xs font-semibold text-text">
                {MESES[p.mes - 1]}
              </div>
              <div className="bg-bg-card px-1.5 py-1">
                <CustoInput value={p.valorPrevisto} onChange={(v) => onAtualizarParcela(i, { valorPrevisto: v })} />
              </div>
              <div className="flex items-center justify-center bg-bg-card px-1.5 py-1">
                <input
                  type="checkbox"
                  checked={p.pago}
                  onChange={(e) => onTogglePago(i, e.target.checked)}
                  className="size-4 rounded border-border accent-primary"
                />
              </div>
              <div className={cn("bg-bg-card px-1.5 py-1", !p.pago && "pointer-events-none opacity-30")}>
                <CustoInput
                  value={p.valorPago}
                  onChange={(v) => onAtualizarParcela(i, { valorPago: v })}
                  disabled={!p.pago}
                />
              </div>
              <div className={cn("flex items-center bg-bg-card px-1.5 py-1", !p.pago && "pointer-events-none opacity-30")}>
                <input
                  type="date"
                  value={p.dataPagamento ?? ""}
                  onChange={(e) => onAtualizarParcela(i, { dataPagamento: e.target.value })}
                  disabled={!p.pago}
                  className="h-8 w-full min-w-0 rounded-[var(--radius-sm)] border border-border bg-bg px-1.5 text-xs text-text outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Pago: {parcelas.filter((p) => p.pago).length} de {parcelas.length} meses.
      </p>
    </div>
  );
}

function EmpresaCampo({
  value,
  empresas,
  onChange,
}: {
  value: string;
  empresas: EmpresaPagadoraDoc[];
  onChange: (nome: string) => void;
}) {
  const { show } = useToast();
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleConfirmarNova() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    try {
      const nome = await garantirEmpresaPagadora(novoNome, empresas);
      onChange(nome);
      setCriando(false);
    } catch {
      show("error", "Não foi possível cadastrar a empresa agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (criando) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleConfirmarNova();
            }
          }}
          placeholder="Nome da nova empresa"
          className="h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-primary bg-bg-card px-3.5 text-sm text-text outline-none ring-2 ring-primary/15"
        />
        <Button type="button" size="sm" loading={salvando} onClick={handleConfirmarNova}>
          Salvar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setCriando(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      placeholder="Selecione a empresa"
      onChange={(e) => {
        if (e.target.value === NOVA_EMPRESA) {
          setNovoNome("");
          setCriando(true);
        } else {
          onChange(e.target.value);
        }
      }}
    >
      {empresas.map((emp) => (
        <option key={emp.id} value={emp.nome}>
          {emp.nome}
        </option>
      ))}
      <option value={NOVA_EMPRESA}>+ Nova empresa…</option>
    </Select>
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
