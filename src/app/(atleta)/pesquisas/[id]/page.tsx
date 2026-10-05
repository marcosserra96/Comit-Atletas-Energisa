"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, ClipboardList, Clock, Lock } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { usePesquisasDoAtleta } from "@/components/pesquisas/PesquisasAtleta";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Select";
import {
  OPCOES_SIM_NAO,
  formatarDataHora,
  formatarDataSimples,
  normalizarRespostas,
  obrigatoriasPendentes,
  respostaVazia,
  situacaoPesquisa,
  type PerguntaPesquisa,
  type RespostaPesquisaDoc,
  type ValorResposta,
} from "@/lib/pesquisas";

/** Texto da resposta já enviada, para a visualização somente leitura. */
function respostaComoTexto(pergunta: PerguntaPesquisa, v: ValorResposta | undefined) {
  if (respostaVazia(v)) return "—";
  if (Array.isArray(v)) return pergunta.tipo === "ordenar" ? v.map((o, i) => `${i + 1}º ${o}`).join(" · ") : v.join(", ");
  if (pergunta.tipo === "data" && typeof v === "string") return formatarDataSimples(v);
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  return String(v);
}

/** Botões de nota (1–5 ou 0–10). */
function Notas({
  de,
  ate,
  valor,
  onChange,
  desabilitado,
  rotulo,
  legendas,
}: {
  de: number;
  ate: number;
  valor: ValorResposta | undefined;
  onChange: (n: number) => void;
  desabilitado: boolean;
  rotulo: string;
  legendas: [string, string];
}) {
  const numeros = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  return (
    <div>
      <div
        className={cn("grid gap-1.5", numeros.length > 5 ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-5 gap-2")}
        role="radiogroup"
        aria-label={rotulo}
      >
        {numeros.map((n) => {
          const ativo = valor === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={desabilitado}
              onClick={() => onChange(n)}
              className={cn(
                "flex h-12 items-center justify-center rounded-[var(--radius)] border text-lg font-bold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96]",
                ativo ? "border-primary bg-primary text-on-primary" : "border-border text-text hover:border-border-strong",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-text-muted">
        <span>{legendas[0]}</span>
        <span>{legendas[1]}</span>
      </div>
    </div>
  );
}

/** Ordenar com setas (funciona bem no toque e no teclado, sem arrastar). */
function Ordenar({
  pergunta,
  valor,
  onChange,
  desabilitado,
}: {
  pergunta: PerguntaPesquisa;
  valor: ValorResposta | undefined;
  onChange: (v: string[]) => void;
  desabilitado: boolean;
}) {
  const respondida = Array.isArray(valor) && valor.length === (pergunta.opcoes ?? []).length;
  const ordem = respondida ? (valor as string[]) : (pergunta.opcoes ?? []);
  const mover = (i: number, delta: number) => {
    const nova = [...ordem];
    const [item] = nova.splice(i, 1);
    nova.splice(i + delta, 0, item);
    onChange(nova);
  };
  const seta =
    "flex size-10 items-center justify-center rounded-[var(--radius)] text-text-light transition-colors hover:bg-bg-inset hover:text-text disabled:pointer-events-none disabled:opacity-25";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">Use as setas: o 1º é o que você mais prefere.</p>
      <ol className="flex flex-col gap-2" aria-label={pergunta.enunciado}>
        {ordem.map((opcao, i) => (
          <li
            key={opcao}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-[var(--radius)] border px-3 py-1.5 text-sm text-text",
              respondida ? "border-primary/40 bg-primary-subtle/60" : "border-border",
            )}
          >
            <span className="w-6 shrink-0 text-center font-bold tabular-nums text-primary">{i + 1}º</span>
            <span className="min-w-0 flex-1">{opcao}</span>
            <button type="button" className={seta} disabled={desabilitado || i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${opcao}`}>
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              className={seta}
              disabled={desabilitado || i === ordem.length - 1}
              onClick={() => mover(i, 1)}
              aria-label={`Descer ${opcao}`}
            >
              <ArrowDown className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      {!respondida ? (
        <Button type="button" variant="secondary" size="sm" className="self-start" disabled={desabilitado} onClick={() => onChange([...ordem])}>
          <Check className="size-4" />
          Manter esta ordem
        </Button>
      ) : null}
    </div>
  );
}

const campo =
  "w-full rounded-[var(--radius)] border border-border bg-bg-card px-3 py-2.5 text-base text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

function CampoPergunta({
  pergunta,
  valor,
  onChange,
  desabilitado,
}: {
  pergunta: PerguntaPesquisa;
  valor: ValorResposta | undefined;
  onChange: (v: ValorResposta) => void;
  desabilitado: boolean;
}) {
  if (pergunta.tipo === "unica" || pergunta.tipo === "multipla") {
    const multipla = pergunta.tipo === "multipla";
    const marcadas = multipla ? (Array.isArray(valor) ? valor : []) : [];
    return (
      <div className="flex flex-col gap-2" role={multipla ? "group" : "radiogroup"} aria-label={pergunta.enunciado}>
        {(pergunta.opcoes ?? []).map((opcao) => {
          const ativo = multipla ? marcadas.includes(opcao) : valor === opcao;
          return (
            <label
              key={opcao}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius)] border px-3.5 py-2.5 text-sm transition-colors",
                ativo ? "border-primary bg-primary-subtle text-text" : "border-border text-text hover:border-border-strong",
                desabilitado && "pointer-events-none opacity-70",
              )}
            >
              <input
                type={multipla ? "checkbox" : "radio"}
                name={pergunta.id}
                checked={ativo}
                disabled={desabilitado}
                onChange={() =>
                  onChange(
                    multipla
                      ? ativo
                        ? marcadas.filter((o) => o !== opcao)
                        : [...marcadas, opcao]
                      : opcao,
                  )
                }
                className="size-5 shrink-0 accent-primary"
              />
              {opcao}
            </label>
          );
        })}
        {multipla ? <p className="text-xs text-text-muted">Pode marcar mais de uma.</p> : null}
      </div>
    );
  }
  if (pergunta.tipo === "escala") {
    return (
      <Notas de={1} ate={5} valor={valor} onChange={onChange} desabilitado={desabilitado} rotulo={pergunta.enunciado} legendas={["Muito ruim", "Excelente"]} />
    );
  }
  if (pergunta.tipo === "nps") {
    return (
      <Notas
        de={0}
        ate={10}
        valor={valor}
        onChange={onChange}
        desabilitado={desabilitado}
        rotulo={pergunta.enunciado}
        legendas={["Não recomendaria", "Com certeza"]}
      />
    );
  }
  if (pergunta.tipo === "sim_nao") {
    return (
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={pergunta.enunciado}>
        {OPCOES_SIM_NAO.map((o) => {
          const ativo = valor === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={desabilitado}
              onClick={() => onChange(o)}
              className={cn(
                "flex h-12 items-center justify-center rounded-[var(--radius)] border text-base font-bold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97]",
                ativo ? "border-primary bg-primary text-on-primary" : "border-border text-text hover:border-border-strong",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (pergunta.tipo === "lista") {
    return (
      <Select
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={desabilitado}
        aria-label={pergunta.enunciado}
      >
        <option value="">Escolha uma opção</option>
        {(pergunta.opcoes ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  if (pergunta.tipo === "ordenar") {
    return <Ordenar pergunta={pergunta} valor={valor} onChange={onChange} desabilitado={desabilitado} />;
  }
  if (pergunta.tipo === "numero") {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={typeof valor === "number" ? String(valor).replace(".", ",") : typeof valor === "string" ? valor : ""}
        onChange={(e) => {
          const texto = e.target.value.replace(/[^\d,.-]/g, "");
          const numero = Number(texto.replace(",", "."));
          // Guarda número quando o valor está completo; "12," fica como texto até terminar.
          onChange(texto !== "" && !/[,.]$/.test(texto) && Number.isFinite(numero) ? numero : texto);
        }}
        disabled={desabilitado}
        placeholder="Digite um número"
        aria-label={pergunta.enunciado}
        className={cn(campo, "h-12 max-w-48 py-0 tabular-nums")}
      />
    );
  }
  if (pergunta.tipo === "data") {
    return (
      <input
        type="date"
        min="2020-01-01"
        max="2099-12-31"
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={desabilitado}
        aria-label={pergunta.enunciado}
        className={cn(campo, "h-12 max-w-56 py-0")}
      />
    );
  }
  if (pergunta.tipo === "texto_longo") {
    return (
      <textarea
        rows={4}
        maxLength={2000}
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={desabilitado}
        placeholder="Escreva sua resposta"
        aria-label={pergunta.enunciado}
        className={campo}
      />
    );
  }
  return (
    <input
      maxLength={200}
      value={typeof valor === "string" ? valor : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={desabilitado}
      placeholder="Sua resposta"
      aria-label={pergunta.enunciado}
      className={cn(campo, "h-12 py-0")}
    />
  );
}

export default function ResponderPesquisaPage() {
  const { id } = useParams<{ id: string }>();
  const { atleta, isPreview, withPreview } = useAthleteView();
  const { pesquisas, respondidas, carregando, marcarRespondida } = usePesquisasDoAtleta();
  const { show } = useToast();
  const [respostas, setRespostas] = useState<Record<string, ValorResposta>>({});
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [minhaResposta, setMinhaResposta] = useState<RespostaPesquisaDoc | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const pesquisa = pesquisas.find((p) => p.id === id);
  const jaRespondida = respondidas.has(id);

  useEffect(() => {
    if (!jaRespondida) return;
    getDoc(doc(db, "pesquisas", id, "respostas", atleta.id))
      .then((s) => setMinhaResposta(s.exists() ? (s.data() as RespostaPesquisaDoc) : null))
      .catch(() => undefined);
  }, [jaRespondida, id, atleta.id]);

  const voltar = (
    <Link
      href={withPreview("/pesquisas")}
      className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text"
    >
      <ArrowLeft className="size-4" />
      Pesquisas
    </Link>
  );

  if (carregando) return <Card className="h-80 animate-pulse" />;
  if (!pesquisa) {
    return (
      <div className="flex flex-col gap-3">
        {voltar}
        <Card>
          <EmptyState icon={ClipboardList} title="Pesquisa indisponível" description="Ela pode ter sido encerrada ou não é para a sua modalidade." />
        </Card>
      </div>
    );
  }

  const situacao = situacaoPesquisa(pesquisa);
  const pendentes = obrigatoriasPendentes(pesquisa.perguntas, respostas);
  const respondidasNoForm = pesquisa.perguntas.filter((q) => !respostaVazia(respostas[q.id])).length;

  async function enviar() {
    if (!pesquisa) return;
    setTentouEnviar(true);
    if (pendentes.length > 0) {
      refs.current[pendentes[0]]?.scrollIntoView({ behavior: "smooth", block: "center" });
      show("info", "Responda as perguntas obrigatórias marcadas.");
      return;
    }
    setEnviando(true);
    try {
      await setDoc(doc(db, "pesquisas", pesquisa.id, "respostas", atleta.id), {
        atletaId: atleta.id,
        atletaNome: atleta.nome,
        equipe: atleta.equipe,
        respostas: normalizarRespostas(pesquisa.perguntas, respostas),
        respondidoEm: serverTimestamp(),
      });
      marcarRespondida(pesquisa.id);
      setEnviada(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      show("error", "Não foi possível enviar agora. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviada || (jaRespondida && !enviada)) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-10">
        {voltar}
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="text-xl font-extrabold text-text">{enviada ? "Obrigado pela resposta!" : "Você já respondeu"}</h1>
          <p className="max-w-sm text-sm text-text-light">
            {pesquisa.titulo}. Sua resposta foi registrada e não pode ser alterada.
          </p>
          <Link
            href={withPreview("/dashboard")}
            className="mt-2 inline-flex min-h-11 items-center rounded-[var(--radius)] border border-border bg-bg-card px-4 text-sm font-semibold text-text transition-colors hover:bg-bg-subtle"
          >
            Voltar ao início
          </Link>
        </Card>
        {minhaResposta && !enviada ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-light">Suas respostas</h2>
            {pesquisa.perguntas.map((q) => {
              const v = minhaResposta.respostas?.[q.id];
              return (
                <div key={q.id}>
                  <p className="text-sm font-semibold text-text">{q.enunciado}</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-text-light">
                    {respostaComoTexto(q, v)}
                  </p>
                </div>
              );
            })}
          </Card>
        ) : null}
      </div>
    );
  }

  if (situacao !== "aberta") {
    return (
      <div className="flex flex-col gap-3">
        {voltar}
        <Card>
          <EmptyState
            icon={situacao === "agendada" ? Clock : Lock}
            title={situacao === "agendada" ? "Ainda não abriu" : "Pesquisa encerrada"}
            description={
              situacao === "agendada"
                ? `Abre em ${formatarDataHora(pesquisa.abreEm)}.`
                : `Recebeu respostas até ${formatarDataHora(pesquisa.fechaEm)}.`
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-10">
      {voltar}
      <div>
        <h1 className="text-2xl font-extrabold text-text">{pesquisa.titulo}</h1>
        {pesquisa.descricao ? <p className="mt-1 whitespace-pre-line text-text-light">{pesquisa.descricao}</p> : null}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-text-light">
          <Clock className="size-4" aria-hidden="true" />
          Responda até {formatarDataHora(pesquisa.fechaEm)} · respostas identificadas com o seu nome
        </p>
      </div>

      {pesquisa.perguntas.map((q, i) => {
        const faltando = tentouEnviar && pendentes.includes(q.id);
        return (
          <div
            key={q.id}
            ref={(el) => {
              refs.current[q.id] = el;
            }}
          >
            <Card className={cn("flex flex-col gap-3", faltando && "border-danger/60")}>
              <p className="font-semibold text-text">
                <span className="text-text-muted">{i + 1}.</span> {q.enunciado}
                {q.obrigatoria ? <span className="ml-1 text-danger" aria-label="obrigatória">*</span> : null}
              </p>
              <CampoPergunta
                pergunta={q}
                valor={respostas[q.id]}
                onChange={(v) => setRespostas((atual) => ({ ...atual, [q.id]: v }))}
                desabilitado={isPreview}
              />
              {faltando ? <p className="text-sm font-medium text-danger">Esta pergunta é obrigatória.</p> : null}
            </Card>
          </div>
        );
      })}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center gap-3 border-t border-border bg-bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(7,25,45,0.25)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <span className="flex-1 text-sm text-text-light">
          {respondidasNoForm} de {pesquisa.perguntas.length} respondidas
        </span>
        <Button onClick={enviar} loading={enviando} disabled={isPreview}>
          <Check className="size-4" />
          Enviar respostas
        </Button>
      </div>
      {isPreview ? (
        <p className="text-center text-xs text-text-muted">Visualização do comitê: o envio fica desativado.</p>
      ) : null}
    </div>
  );
}
