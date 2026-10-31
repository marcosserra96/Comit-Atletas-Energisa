"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { dataIsoLocal } from "@/lib/date";
import {
  ICONES_DESAFIO,
  LIMITE_TITULO_DESAFIO,
  NIVEIS_DESAFIO,
  noPeriodo,
  statusDoDesafio,
  textoMeta,
  TIPO_DESAFIO,
  validarDesafio,
  type DesafioDoc,
  type ModalidadeDesafio,
  type TipoDesafio,
} from "@/lib/desafios";
import { salvarDesafio, type RascunhoDesafio } from "@/lib/desafiosCliente";
import type { Modalidade } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useToast } from "@/components/ui/Toast";
import { Medalha } from "@/components/conquistas/Medalha";

const TIPOS: TipoDesafio[] = ["treinos", "km", "semanas", "provas"];

/** Primeiro e último dia de um mês (0 = este, 1 = o próximo). */
export function mesInteiro(deslocamento: number) {
  const hoje = dataIsoLocal();
  const d = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 + deslocamento, 1);
  const p = (n: number) => String(n).padStart(2, "0");
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { inicio: `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`, fim: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(ultimo)}` };
}

export function rascunhoPadrao(): RascunhoDesafio {
  return { titulo: "", modalidade: "todas", tipo: "treinos", metas: { corrida: 8, bicicleta: 8 }, ...mesInteiro(0), icone: "bandeira", nivel: 3 };
}

/** Campo numérico de meta (só inteiros; a unidade vai no rótulo). */
function CampoMeta({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <TextField
      label={label}
      inputMode="numeric"
      value={valor}
      className="tabular-nums"
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}

export function DesafioModal({
  aberto,
  inicial,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  /** Com id: editando. Sem id: criando (pode vir de "Duplicar"). */
  inicial: RascunhoDesafio;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { show } = useToast();
  const editando = Boolean(inicial.id);
  const [d, setD] = useState<RascunhoDesafio>(inicial);
  const [metas, setMetas] = useState<Record<Modalidade, string>>({
    corrida: String(inicial.metas.corrida ?? inicial.metas.bicicleta ?? ""),
    bicicleta: String(inicial.metas.bicicleta ?? inicial.metas.corrida ?? ""),
  });
  const [avisar, setAvisar] = useState(!editando);
  // Vazio ou 0: só a medalha.
  const [pontos, setPontos] = useState(inicial.pontos ? String(inicial.pontos) : "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const caixaErro = useRef<HTMLDivElement>(null);
  // O erro aparece no fim do formulário: traz para a vista.
  useEffect(() => {
    if (erro) caixaErro.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [erro]);
  const idTipo = useId();
  const idMedalha = useId();

  const hoje = dataIsoLocal();
  const duasMetas = d.modalidade === "todas" && d.tipo === "km";
  const info = TIPO_DESAFIO[d.tipo];
  const encerrado = statusDoDesafio(d, hoje) === "encerrado";
  const mudar = (parcial: Partial<RascunhoDesafio>) => {
    setD((atual) => ({ ...atual, ...parcial }));
    setErro("");
  };

  // Uma meta só (fora km com as duas modalidades) vale para quem participa.
  function metasParaSalvar(): Partial<Record<Modalidade, number>> {
    const corrida = Number(metas.corrida);
    const bike = Number(duasMetas ? metas.bicicleta : metas.corrida);
    if (d.modalidade === "corrida") return { corrida };
    if (d.modalidade === "bicicleta") return { bicicleta: Number(metas.corrida) };
    return { corrida, bicicleta: bike };
  }

  const prontoParaPrevia: DesafioDoc = { ...d, id: d.id ?? "previa", metas: metasParaSalvar() };
  const modalidadePrevia: Modalidade = d.modalidade === "bicicleta" ? "bicicleta" : "corrida";

  async function salvar() {
    const final = { ...d, metas: metasParaSalvar(), pontos: pontos ? Number(pontos) : 0 };
    const r = validarDesafio(final);
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    setSalvando(true);
    try {
      const { avisados, pontuados = 0 } = await salvarDesafio({ ...r.dados, id: d.id }, avisar && !encerrado);
      const partes = [
        editando ? "Desafio atualizado." : "Desafio criado.",
        !editando && avisados > 0 ? `${avisados} ${avisados === 1 ? "atleta avisado" : "atletas avisados"} no celular.` : "",
        pontuados > 0 ? `${pontuados} ${pontuados === 1 ? "atleta que já tinha completado recebeu" : "atletas que já tinham completado receberam"} os pontos.` : "",
      ];
      show("success", partes.filter(Boolean).join(" "));
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      mobileSheet
      size="md"
      title={editando ? "Editar desafio" : "Novo desafio"}
      description="Quem cumprir a meta dentro do período ganha a medalha e, se você quiser, pontos."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} loading={salvando}>
            {editando ? "Salvar alterações" : "Criar desafio"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <TextField
          label="Nome do desafio"
          placeholder="Ex.: Outubro Rosa"
          value={d.titulo}
          maxLength={LIMITE_TITULO_DESAFIO}
          onChange={(e) => mudar({ titulo: e.target.value })}
          action={<span className="text-xs tabular-nums text-text-muted">{d.titulo.length}/{LIMITE_TITULO_DESAFIO}</span>}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Quem participa</span>
          <SegmentedControl<ModalidadeDesafio>
            value={d.modalidade}
            onChange={(modalidade) => mudar({ modalidade })}
            options={[
              { value: "todas", label: "Corrida e Bike" },
              { value: "corrida", label: "Corrida" },
              { value: "bicicleta", label: "Bike" },
            ]}
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend id={idTipo} className="mb-1.5 text-sm font-medium text-text">
            O que conta
          </legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={idTipo}>
            {TIPOS.map((t) => {
              const ativo = d.tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => mudar({ tipo: t })}
                  className={cn(
                    "flex min-h-11 flex-col items-start rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    ativo ? "border-primary bg-primary-subtle" : "border-border bg-bg hover:border-border-strong",
                  )}
                >
                  <span className={cn("text-sm font-semibold", ativo ? "text-primary" : "text-text")}>{TIPO_DESAFIO[t].rotulo}</span>
                  <span className="mt-0.5 text-xs leading-snug text-text-light">{TIPO_DESAFIO[t].ajuda}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className={cn("grid gap-3", duasMetas ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
          {duasMetas ? (
            <>
              <CampoMeta label="Meta da Corrida (km)" valor={metas.corrida} onChange={(v) => setMetas((m) => ({ ...m, corrida: v }))} />
              <CampoMeta label="Meta da Bike (km)" valor={metas.bicicleta} onChange={(v) => setMetas((m) => ({ ...m, bicicleta: v }))} />
            </>
          ) : (
            <CampoMeta label={`Meta (${info.plural})`} valor={metas.corrida} onChange={(v) => setMetas({ corrida: v, bicicleta: v })} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Começa em" type="date" value={d.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
            <TextField label="Termina em" type="date" value={d.fim} min={d.inicio} onChange={(e) => mudar({ fim: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { rotulo: "Este mês", ...mesInteiro(0) },
              { rotulo: "Próximo mês", ...mesInteiro(1) },
            ].map((p) => {
              const ativo = d.inicio === p.inicio && d.fim === p.fim;
              return (
                <button
                  key={p.rotulo}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => mudar({ inicio: p.inicio, fim: p.fim })}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:min-h-11",
                    ativo ? "border-primary bg-primary-subtle text-primary" : "border-border text-text-light hover:text-text",
                  )}
                >
                  {p.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-3">
            <div className="w-36 shrink-0">
              <TextField
                label="Pontos ao concluir"
                inputMode="numeric"
                placeholder="Só medalha"
                value={pontos}
                className="tabular-nums"
                onChange={(e) => {
                  setPontos(e.target.value.replace(/\D/g, "").slice(0, 3));
                  setErro("");
                }}
              />
            </div>
            <p className="pb-2.5 text-xs text-text-light">
              {Number(pontos) > 0
                ? `Quem completar ganha a medalha e ${pontos} ${Number(pontos) === 1 ? "ponto" : "pontos"}, lançados sozinhos no dia em que completou.`
                : "Deixe em branco para dar só a medalha."}
            </p>
          </div>
          {editando && Number(pontos) !== (inicial.pontos ?? 0) ? (
            <p className="text-xs text-text-muted">
              {Number(pontos) > 0
                ? "Quem já completou recebe ou tem os pontos ajustados ao salvar."
                : "Ao salvar, os pontos já dados por este desafio são estornados. A medalha continua."}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend id={idMedalha} className="mb-2 text-sm font-medium text-text">
            Medalha
          </legend>
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-bg-inset p-3.5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 sm:w-44 sm:flex-col sm:text-center">
              <Medalha icone={d.icone} nivel={d.nivel} conquistada tamanho={72} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text">{d.titulo.trim() || "Nome do desafio"}</p>
                <p className="text-xs text-text-light">
                  {textoMeta(prontoParaPrevia, modalidadePrevia)} {noPeriodo(prontoParaPrevia)}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="grid w-fit grid-cols-4 gap-1.5" role="radiogroup" aria-label="Ícone da medalha">
                {ICONES_DESAFIO.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    role="radio"
                    aria-checked={d.icone === i.id}
                    aria-label={i.rotulo}
                    title={i.rotulo}
                    onClick={() => mudar({ icone: i.id })}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      d.icone === i.id ? "border-primary bg-bg-card" : "border-transparent hover:bg-bg-card",
                    )}
                  >
                    <Medalha icone={i.id} nivel={d.nivel} conquistada tamanho={34} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor da medalha">
                {NIVEIS_DESAFIO.map((n) => (
                  <button
                    key={n.nivel}
                    type="button"
                    role="radio"
                    aria-checked={d.nivel === n.nivel}
                    onClick={() => mudar({ nivel: n.nivel })}
                    className={cn(
                      "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:min-h-11",
                      d.nivel === n.nivel ? "border-primary bg-bg-card text-primary" : "border-border text-text-light hover:text-text",
                    )}
                  >
                    {n.rotulo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        {editando ? null : (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3.5 py-2">
            <div>
              <p className="text-sm font-semibold text-text">Avisar os atletas no celular</p>
              <p className="text-xs text-text-light">
                {encerrado ? "O período já terminou: ninguém será avisado." : "Quem ativou as notificações recebe o desafio ao criar."}
              </p>
            </div>
            <Switch ativo={avisar && !encerrado} disabled={encerrado} onChange={setAvisar} rotulo="Avisar os atletas no celular" />
          </div>
        )}

        <div ref={caixaErro}>{erro ? <InlineAlert tone="danger">{erro}</InlineAlert> : null}</div>
      </div>
    </Modal>
  );
}
