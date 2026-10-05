"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Timestamp,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckSquare,
  CircleDot,
  Copy,
  Gauge,
  Hash,
  ListOrdered,
  Plus,
  SquareChevronDown,
  Star,
  ThumbsUp,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { DataHoraField } from "@/components/ui/DataHoraField";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { temPermissao } from "@/lib/permissoes";
import { useBuscaDaUrl } from "@/lib/useBuscaDaUrl";
import {
  TIPO_PERGUNTA_DICA,
  TIPO_PERGUNTA_LABEL,
  limparPerguntas,
  novaPergunta,
  problemasDaPesquisa,
  temOpcoes,
  type PerguntaPesquisa,
  type PesquisaDoc,
  type PublicoPesquisa,
  type TipoPergunta,
} from "@/lib/pesquisas";

type Rascunho = Pick<PesquisaDoc, "titulo" | "descricao" | "perguntas" | "publico" | "abreEm" | "fechaEm" | "publicada">;

const ICONE_TIPO: Record<TipoPergunta, typeof Type> = {
  unica: CircleDot,
  multipla: CheckSquare,
  lista: SquareChevronDown,
  sim_nao: ThumbsUp,
  escala: Star,
  nps: Gauge,
  ordenar: ListOrdered,
  numero: Hash,
  data: CalendarDays,
  texto_curto: Type,
  texto_longo: AlignLeft,
};

const previa =
  "rounded-[var(--radius)] border border-dashed border-border px-3 py-2.5 text-sm text-text-muted";

function rascunhoInicial(): Rascunho {
  const abre = new Date();
  abre.setMinutes(0, 0, 0);
  abre.setHours(abre.getHours() + 1);
  const fecha = new Date(abre);
  fecha.setDate(fecha.getDate() + 7);
  fecha.setHours(23, 59, 0, 0);
  return {
    titulo: "",
    descricao: "",
    perguntas: [novaPergunta("unica")],
    publico: "todos",
    abreEm: abre.toISOString(),
    fechaEm: fecha.toISOString(),
    publicada: false,
  };
}

const campoTexto =
  "w-full rounded-[var(--radius)] border border-border bg-bg-card px-3 py-2.5 text-base text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";

function EditorPergunta({
  pergunta,
  indice,
  total,
  onChange,
  onMover,
  onDuplicar,
  onRemover,
}: {
  pergunta: PerguntaPesquisa;
  indice: number;
  total: number;
  onChange: (p: PerguntaPesquisa) => void;
  onMover: (delta: number) => void;
  onDuplicar: () => void;
  onRemover: () => void;
}) {
  const opcoes = pergunta.opcoes ?? [];
  const IconeOpcao = pergunta.tipo === "multipla" ? CheckSquare : CircleDot;
  const ordenar = pergunta.tipo === "ordenar";
  const botaoIcone =
    "flex size-9 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-bg-subtle hover:text-text disabled:opacity-30 disabled:pointer-events-none";

  function trocarTipo(tipo: TipoPergunta) {
    onChange({
      ...pergunta,
      tipo,
      opcoes: temOpcoes(tipo) ? (opcoes.length >= 2 ? opcoes : ["", ""]) : undefined,
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-bold text-primary">
          {indice + 1}
        </span>
        <Select
          className="w-52"
          value={pergunta.tipo}
          onChange={(e) => trocarTipo(e.target.value as TipoPergunta)}
          aria-label={`Tipo da pergunta ${indice + 1}`}
        >
          {(Object.keys(TIPO_PERGUNTA_LABEL) as TipoPergunta[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_PERGUNTA_LABEL[t]}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex">
          <button type="button" className={botaoIcone} onClick={() => onMover(-1)} disabled={indice === 0} aria-label="Subir pergunta">
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            className={botaoIcone}
            onClick={() => onMover(1)}
            disabled={indice === total - 1}
            aria-label="Descer pergunta"
          >
            <ArrowDown className="size-4" />
          </button>
          <button type="button" className={botaoIcone} onClick={onDuplicar} aria-label="Duplicar pergunta">
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            className={cn(botaoIcone, "hover:bg-danger/10 hover:text-danger")}
            onClick={onRemover}
            disabled={total === 1}
            aria-label="Remover pergunta"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <TextField
        label="Pergunta"
        placeholder="Ex: Qual horário de treino funciona melhor para você?"
        value={pergunta.enunciado}
        onChange={(e) => onChange({ ...pergunta, enunciado: e.target.value })}
      />

      {temOpcoes(pergunta.tipo) ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text">
            {ordenar ? "Opções (o atleta põe em ordem de preferência)" : "Opções"}
          </span>
          {opcoes.map((opcao, i) => (
            <div key={i} className="flex items-center gap-2">
              {ordenar || pergunta.tipo === "lista" ? (
                <span className="w-4 shrink-0 text-center text-xs font-bold text-text-muted" aria-hidden="true">
                  {i + 1}
                </span>
              ) : (
                <IconeOpcao className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              )}
              <input
                value={opcao}
                onChange={(e) => {
                  const novas = [...opcoes];
                  novas[i] = e.target.value;
                  onChange({ ...pergunta, opcoes: novas });
                }}
                placeholder={`Opção ${i + 1}`}
                aria-label={`Opção ${i + 1}`}
                className={cn(campoTexto, "h-10 py-0")}
              />
              <button
                type="button"
                className={botaoIcone}
                disabled={opcoes.length <= 2}
                onClick={() => onChange({ ...pergunta, opcoes: opcoes.filter((_, j) => j !== i) })}
                aria-label={`Remover opção ${i + 1}`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...pergunta, opcoes: [...opcoes, ""] })}
            className="flex min-h-10 items-center gap-2 self-start rounded-[var(--radius)] px-2 text-sm font-semibold text-primary hover:bg-primary-subtle"
          >
            <Plus className="size-4" />
            Adicionar opção
          </button>
        </div>
      ) : pergunta.tipo === "escala" ? (
        <div className="flex items-center gap-2 text-sm text-text-light">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="flex size-9 items-center justify-center rounded-[var(--radius)] border border-border font-semibold">
              {n}
            </span>
          ))}
          <span className="ml-1">1 = muito ruim · 5 = excelente</span>
        </div>
      ) : pergunta.tipo === "nps" ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-11 gap-1 text-xs font-semibold text-text-light">
            {Array.from({ length: 11 }, (_, n) => (
              <span key={n} className="flex h-8 items-center justify-center rounded-[var(--radius)] border border-border">
                {n}
              </span>
            ))}
          </div>
          <span className="text-xs text-text-muted">0 = não recomendaria · 10 = recomendaria com certeza</span>
        </div>
      ) : pergunta.tipo === "sim_nao" ? (
        <div className="flex gap-2">
          {["Sim", "Não"].map((o) => (
            <span key={o} className="flex h-9 w-20 items-center justify-center rounded-full border border-border text-sm font-semibold text-text-light">
              {o}
            </span>
          ))}
        </div>
      ) : (
        <div className={cn(previa, pergunta.tipo === "texto_longo" && "py-6")}>
          {pergunta.tipo === "numero"
            ? "O atleta digita um número."
            : pergunta.tipo === "data"
              ? "O atleta escolhe uma data no calendário."
              : `O atleta escreve a resposta aqui${pergunta.tipo === "texto_longo" ? " (texto longo)" : ""}.`}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2.5 self-start text-sm text-text">
        <input
          type="checkbox"
          checked={pergunta.obrigatoria}
          onChange={(e) => onChange({ ...pergunta, obrigatoria: e.target.checked })}
          className="size-4 rounded border-border accent-primary"
        />
        Resposta obrigatória
      </label>
    </Card>
  );
}

export default function EditarPesquisaPage() {
  const { id: idDaRota } = useParams<{ id: string }>();
  const router = useRouter();
  const busca = useBuscaDaUrl();
  const { usuario, uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const pode = temPermissao(usuario, "pesquisas");
  const nova = idDaRota === "nova";
  const [id] = useState(() => (nova ? doc(collection(db, "pesquisas")).id : idDaRota));
  const [rascunhoEditado, setRascunho] = useState<Rascunho>(rascunhoInicial);
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null);
  const [existente, setExistente] = useState<PesquisaDoc | null>(null);
  const [totalRespostas, setTotalRespostas] = useState(0);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState<"rascunho" | "publicar" | null>(null);

  // De onde vem o conteúdo: a própria pesquisa (edição), a original (duplicar) ou nada (nova).
  const origem = busca === undefined ? undefined : nova ? new URLSearchParams(busca).get("copiar") : idDaRota;
  useEffect(() => {
    if (!pode || !origem) return;
    getDoc(doc(db, "pesquisas", origem))
      .then((snap) => {
        setCarregadoDe(origem);
        if (!snap.exists()) return;
        const p = { ...(snap.data() as PesquisaDoc), id: snap.id };
        if (nova) {
          const base = rascunhoInicial();
          setRascunho({ ...p, titulo: `${p.titulo} (cópia)`, publicada: false, abreEm: base.abreEm, fechaEm: base.fechaEm });
        } else {
          setExistente(p);
          setRascunho(p);
        }
      })
      .catch(() => setCarregadoDe(origem));
    if (!nova) {
      getCountFromServer(collection(db, "pesquisas", idDaRota, "respostas"))
        .then((s) => setTotalRespostas(s.data().count))
        .catch(() => undefined);
    }
  }, [pode, origem, nova, idDaRota]);

  if (!pode) return <NotAuthorized />;
  if (origem === undefined || (origem && carregadoDe !== origem)) return <Card className="h-96 animate-pulse" />;
  const rascunho = rascunhoEditado;

  const atualizar = (parcial: Partial<Rascunho>) => setRascunho({ ...rascunho, ...parcial });
  const perguntas = rascunho.perguntas;
  const alterarPergunta = (i: number, p: PerguntaPesquisa) =>
    atualizar({ perguntas: perguntas.map((q, j) => (j === i ? p : q)) });

  async function salvar(publicar: boolean) {
    if (!rascunho) return;
    const lista = problemasDaPesquisa(rascunho);
    if (publicar && lista.length > 0) {
      setProblemas(lista);
      show("info", "Ajuste os pontos indicados antes de publicar.");
      return;
    }
    setProblemas([]);
    setSalvando(publicar ? "publicar" : "rascunho");
    try {
      await setDoc(doc(db, "pesquisas", id), {
        id,
        titulo: rascunho.titulo.trim(),
        descricao: rascunho.descricao.trim(),
        perguntas: limparPerguntas(rascunho.perguntas),
        publico: rascunho.publico,
        abreEm: rascunho.abreEm,
        fechaEm: rascunho.fechaEm,
        abreEmTs: rascunho.abreEm ? Timestamp.fromDate(new Date(rascunho.abreEm)) : null,
        fechaEmTs: rascunho.fechaEm ? Timestamp.fromDate(new Date(rascunho.fechaEm)) : null,
        publicada: publicar,
        criadoEm: existente?.criadoEm ?? serverTimestamp(),
        criadoPor: existente?.criadoPor ?? uid,
        criadoPorNome: existente?.criadoPorNome ?? autor.nome,
        atualizadoEm: serverTimestamp(),
      });
      show(
        "success",
        publicar
          ? "Pesquisa publicada. Os atletas recebem o aviso quando ela abrir."
          : "Rascunho salvo. Os atletas ainda não veem esta pesquisa.",
      );
      router.push("/gestao/pesquisas");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(null);
    }
  }

  const publicada = existente?.publicada === true;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-4">
      <div>
        <Link
          href="/gestao/pesquisas"
          className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text"
        >
          <ArrowLeft className="size-4" />
          Pesquisas
        </Link>
        <h1 className="text-2xl font-extrabold text-text">
          {nova ? "Nova pesquisa" : publicada ? "Editar pesquisa publicada" : "Editar pesquisa"}
        </h1>
      </div>

      {totalRespostas > 0 ? (
        <InlineAlert tone="warning">
          Esta pesquisa já tem {plural(totalRespostas, "resposta")}. Corrigir textos é seguro; remover perguntas ou
          opções faz as respostas dadas a elas sumirem dos resultados.
        </InlineAlert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <TextField
          label="Título"
          placeholder="Ex: Pesquisa de satisfação · 2º semestre"
          value={rascunho.titulo}
          onChange={(e) => atualizar({ titulo: e.target.value })}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Descrição (opcional)</span>
          <textarea
            rows={3}
            value={rascunho.descricao}
            onChange={(e) => atualizar({ descricao: e.target.value })}
            placeholder="Conte ao atleta o objetivo da pesquisa e quanto tempo leva."
            className={campoTexto}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Quem responde</span>
          <SegmentedControl
            value={rascunho.publico}
            onChange={(v) => atualizar({ publico: v as PublicoPesquisa })}
            options={[
              { value: "todos", label: "Corrida e Bike" },
              { value: "corrida", label: "Corrida" },
              { value: "bicicleta", label: "Bike" },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DataHoraField label="Abre em" value={rascunho.abreEm} onChange={(iso) => atualizar({ abreEm: iso })} />
          <DataHoraField
            label="Fecha em"
            value={rascunho.fechaEm}
            onChange={(iso) => atualizar({ fechaEm: iso })}
            error={
              rascunho.abreEm && rascunho.fechaEm && rascunho.fechaEm <= rascunho.abreEm
                ? "Precisa ser depois da abertura."
                : undefined
            }
          />
        </div>
        <p className="-mt-1 text-xs text-text-muted">
          Enquanto estiver aberta, o atleta vê um aviso ao entrar no portal. Respostas identificadas com o nome do atleta.
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        {perguntas.map((p, i) => (
          <EditorPergunta
            key={p.id}
            pergunta={p}
            indice={i}
            total={perguntas.length}
            onChange={(nova) => alterarPergunta(i, nova)}
            onMover={(delta) => {
              const lista = [...perguntas];
              const [item] = lista.splice(i, 1);
              lista.splice(i + delta, 0, item);
              atualizar({ perguntas: lista });
            }}
            onDuplicar={() => {
              const lista = [...perguntas];
              lista.splice(i + 1, 0, { ...p, id: novaPergunta().id, opcoes: p.opcoes ? [...p.opcoes] : undefined });
              atualizar({ perguntas: lista });
            }}
            onRemover={() => atualizar({ perguntas: perguntas.filter((_, j) => j !== i) })}
          />
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-text">Adicionar pergunta</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(TIPO_PERGUNTA_LABEL) as TipoPergunta[]).map((t) => {
            const Icone = ICONE_TIPO[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => atualizar({ perguntas: [...perguntas, novaPergunta(t)] })}
                className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary-subtle text-primary">
                  <Icone className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">{TIPO_PERGUNTA_LABEL[t]}</span>
                  <span className="block text-xs leading-snug text-text-light">{TIPO_PERGUNTA_DICA[t]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {problemas.length > 0 ? (
        <InlineAlert tone="danger">
          <ul className="list-disc pl-4">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(7,25,45,0.25)] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <Button
          variant="secondary"
          onClick={() => salvar(false)}
          loading={salvando === "rascunho"}
          disabled={salvando !== null}
          className="w-full sm:w-auto"
        >
          {publicada ? "Voltar para rascunho" : "Salvar rascunho"}
        </Button>
        <Button
          onClick={() => salvar(true)}
          loading={salvando === "publicar"}
          disabled={salvando !== null}
          className="w-full sm:w-auto"
        >
          {publicada ? "Salvar alterações" : "Publicar pesquisa"}
        </Button>
      </div>
    </div>
  );
}
