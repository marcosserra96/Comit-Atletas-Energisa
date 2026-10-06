"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import { BellRing, CalendarClock, ClipboardList, Megaphone, Newspaper, Send, UsersRound } from "lucide-react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { temPermissao } from "@/lib/permissoes";
import { plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  DESTINOS_PUSH,
  LIMITE_CORPO,
  LIMITE_TITULO,
  ORIGEM_PUSH_LABEL,
  validarMensagem,
  type OrigemPush,
  type PublicoPush,
} from "@/lib/push/regras";
import {
  alcancePush,
  carregarDestinatarios,
  carregarPainelPush,
  enviarPushManual,
  type PainelPush,
  type PessoaPush,
} from "@/lib/push/comite";
import { SeletorDePessoas } from "@/components/push/SeletorDePessoas";

const PUBLICO_LABEL: Record<PublicoPush, string> = {
  todos: "Corrida e Bike",
  corrida: "Corrida",
  bicicleta: "Bike",
  selecionados: "Pessoas escolhidas",
};

/** "Ana, Bruno e mais 3" */
function resumoNomes(nomes: string[], total = nomes.length) {
  if (total === 0) return "";
  const primeiros = nomes.slice(0, 3).join(", ");
  return total > 3 ? `${primeiros} e mais ${total - 3}` : primeiros;
}

const ICONE_ORIGEM: Record<OrigemPush, typeof Send> = {
  manual: Megaphone,
  noticia: Newspaper,
  pesquisa_abertura: ClipboardList,
  pesquisa_lembrete: ClipboardList,
  reuniao: UsersRound,
};

function dataHora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(", ", " às ");
}

/** Como a notificação aparece na tela de bloqueio do celular. */
function Previa({ titulo, corpo }: { titulo: string; corpo: string }) {
  return (
    <div className="rounded-[22px] bg-gradient-to-br from-navy to-[#0d3a5c] p-4" aria-label="Prévia da notificação">
      <div className="flex gap-3 rounded-[16px] bg-white/90 p-3 shadow-lg backdrop-blur">
        <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-[#111]">{titulo || "Título do aviso"}</p>
            <span className="shrink-0 text-[11px] text-[#666]">agora</span>
          </div>
          <p className="line-clamp-3 text-[13px] leading-snug text-[#333]">{corpo || "A mensagem aparece aqui."}</p>
        </div>
      </div>
    </div>
  );
}

function Contador({ atual, limite }: { atual: number; limite: number }) {
  return (
    <span className={cn("text-xs tabular-nums", atual > limite ? "font-semibold text-danger" : "text-text-muted")}>
      {atual}/{limite}
    </span>
  );
}

const AUTOMATICAS = [
  { icone: UsersRound, titulo: "Reunião começando", texto: "Quando abre a confirmação de presença. Só para quem ainda não confirmou." },
  { icone: ClipboardList, titulo: "Pesquisa nova", texto: "Quando a pesquisa abre, para o público dela." },
  { icone: CalendarClock, titulo: "Último dia da pesquisa", texto: "24 h antes de fechar, só para quem não respondeu." },
  { icone: Newspaper, titulo: "Notícia", texto: "Quando quem publica marca “Avisar os atletas no celular”." },
];

export default function NotificacoesPage() {
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const pode = temPermissao(usuario, "notificacoes");
  const idMensagem = useId();
  const [painel, setPainel] = useState<PainelPush | null>(null);
  const [erroPainel, setErroPainel] = useState("");
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [publico, setPublico] = useState<PublicoPush>("todos");
  const [link, setLink] = useState<string>("/dashboard");
  const [confirmando, setConfirmando] = useState<{ atletas: number } | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [pessoas, setPessoas] = useState<PessoaPush[] | null>(null);
  const [erroPessoas, setErroPessoas] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const escolhendo = publico === "selecionados";

  // A lista só é buscada quando o comitê escolhe "Escolher pessoas".
  useEffect(() => {
    if (!escolhendo || pessoas !== null) return;
    carregarDestinatarios()
      .then(setPessoas)
      .catch((e: unknown) => setErroPessoas(e instanceof Error ? e.message : "Não foi possível carregar a lista."));
  }, [escolhendo, pessoas]);

  const recarregar = useCallback(() => {
    carregarPainelPush()
      .then((p) => {
        setPainel(p);
        setErroPainel("");
      })
      .catch((e: unknown) => setErroPainel(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, []);

  useEffect(() => {
    if (pode) recarregar();
  }, [pode, recarregar]);

  if (!pode) return <NotAuthorized />;

  const erros = validarMensagem({ titulo, corpo, link });
  const comAvisos = painel ? painel.alcance.corrida + painel.alcance.bicicleta : null;

  const idsEscolhidos = [...selecionados];
  const nomesEscolhidos = (pessoas ?? []).filter((p) => selecionados.has(p.id)).map((p) => p.nome);

  async function revisar() {
    setTentou(true);
    if (erros.length) return;
    if (escolhendo && selecionados.size === 0) {
      show("info", "Escolha ao menos uma pessoa para receber.");
      return;
    }
    setVerificando(true);
    try {
      setConfirmando(await alcancePush(publico, escolhendo ? idsEscolhidos : undefined));
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível verificar o alcance.");
    } finally {
      setVerificando(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    try {
      const r = await enviarPushManual({
        titulo: titulo.trim(),
        corpo: corpo.trim(),
        publico,
        link,
        atletaIds: escolhendo ? idsEscolhidos : undefined,
      });
      show(
        "success",
        r.atletas > 0
          ? `Aviso enviado para ${plural(r.atletas, escolhendo ? "pessoa" : "atleta")}.`
          : "Ninguém com notificações ativas para receber.",
      );
      if (escolhendo) setSelecionados(new Set());
      setConfirmando(null);
      setTitulo("");
      setCorpo("");
      setTentou(false);
      recarregar();
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        subtitle="Avisos que chegam no celular dos atletas, mesmo com o app fechado."
        icon={BellRing}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-bold text-text">Enviar um aviso</h2>
              <p className="text-sm text-text-light">Use para recados rápidos: mudança de horário, lembrete de prova, novidade importante.</p>
            </div>

            <TextField
              label="Título"
              placeholder="Ex: Treino de sábado mudou para as 7h"
              value={titulo}
              maxLength={LIMITE_TITULO + 20}
              onChange={(e) => setTitulo(e.target.value)}
              action={<Contador atual={titulo.trim().length} limite={LIMITE_TITULO} />}
              error={tentou && !titulo.trim() ? "Escreva o título." : undefined}
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={idMensagem} className="text-sm font-medium text-text">
                  Mensagem
                </label>
                <Contador atual={corpo.trim().length} limite={LIMITE_CORPO} />
              </div>
              <textarea
                id={idMensagem}
                rows={3}
                value={corpo}
                maxLength={LIMITE_CORPO + 40}
                onChange={(e) => setCorpo(e.target.value)}
                placeholder="Curta e direta: aparece na tela de bloqueio."
                className={cn(
                  "w-full rounded-[var(--radius)] border bg-bg px-3.5 py-2.5 text-base text-text outline-none placeholder:text-text-muted focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15 sm:text-sm",
                  tentou && !corpo.trim() ? "border-danger" : "border-border",
                )}
              />
              {tentou && !corpo.trim() ? <span className="text-xs font-medium text-danger">Escreva a mensagem.</span> : null}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text">Para quem</span>
              <SegmentedControl
                className="max-w-full overflow-x-auto"
                value={publico}
                onChange={(v) => setPublico(v as PublicoPush)}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "corrida", label: "Corrida" },
                  { value: "bicicleta", label: "Bike" },
                  {
                    value: "selecionados",
                    label: selecionados.size > 0 ? `Escolher pessoas (${selecionados.size})` : "Escolher pessoas",
                  },
                ]}
              />
              {escolhendo ? (
                <SeletorDePessoas
                  pessoas={pessoas}
                  erro={erroPessoas}
                  selecionados={selecionados}
                  onChange={setSelecionados}
                />
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Ao tocar, abre</span>
                <Select value={link} onChange={(e) => setLink(e.target.value)} aria-label="Tela aberta ao tocar">
                  {DESTINOS_PUSH.map((d) => (
                    <option key={d.href} value={d.href}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-muted">
                Chega só para quem ativou as notificações{comAvisos !== null ? ` (${plural(comAvisos, "atleta")} hoje)` : ""}.
              </p>
              <Button onClick={() => void revisar()} loading={verificando}>
                <Send className="size-4" />
                Revisar e enviar
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-4" padding="none">
            <h2 className="px-5 pt-5 text-lg font-bold text-text">Enviadas</h2>
            {erroPainel ? (
              <p className="px-5 pb-5 text-sm text-danger">{erroPainel}</p>
            ) : !painel ? (
              <div className="mx-5 mb-5 h-32 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            ) : painel.envios.length === 0 ? (
              <EmptyState icon={BellRing} title="Nenhuma notificação enviada ainda" description="Os avisos automáticos e os enviados por aqui aparecem nesta lista." />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {painel.envios.map((e) => {
                  const Icone = ICONE_ORIGEM[e.origem] ?? Send;
                  return (
                    <li key={e.id} className="flex gap-3 px-5 py-3.5">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-bg-inset text-text-light">
                        <Icone className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-semibold text-text">{e.titulo}</p>
                          <Badge tone={e.origem === "manual" ? "primary" : "neutral"}>{ORIGEM_PUSH_LABEL[e.origem] ?? e.origem}</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-text-light">{e.corpo}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {dataHora(e.criadoEm)} ·{" "}
                          {e.publico === "selecionados" && e.destinatarios?.length
                            ? `Para ${resumoNomes(e.destinatarios)}`
                            : PUBLICO_LABEL[e.publico] ?? e.publico}{" "}
                          · {plural(e.atletas, e.publico === "selecionados" ? "pessoa" : "atleta")}
                          {e.autorNome ? ` · por ${e.autorNome}` : ""}
                          {e.falhas > 0 ? ` · ${plural(e.falhas, "falha")}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">Prévia</p>
            <Previa titulo={titulo.trim()} corpo={corpo.trim()} />
          </Card>

          <Card className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">Quem recebe hoje</p>
            {painel ? (
              <>
                <p className="text-3xl font-black tabular-nums text-text">
                  {comAvisos}
                  <span className="ml-1.5 text-sm font-semibold text-text-light">de {painel.alcance.atletasAtivos} atletas</span>
                </p>
                <div className="h-2.5 overflow-hidden rounded-full bg-bg-inset" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${painel.alcance.atletasAtivos ? Math.round(((comAvisos ?? 0) / painel.alcance.atletasAtivos) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-sm text-text-light">
                  Corrida {painel.alcance.corrida} · Bike {painel.alcance.bicicleta}. Cada atleta ativa no próprio celular
                  (convite no Início e no Perfil do app).
                </p>
              </>
            ) : (
              <div className="h-20 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">Automáticas</p>
            <ul className="flex flex-col gap-3">
              {AUTOMATICAS.map(({ icone: Icone, titulo: t, texto }) => (
                <li key={t} className="flex gap-3">
                  <Icone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-text">{t}</p>
                    <p className="text-xs text-text-light">{texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <Modal
        open={confirmando !== null}
        onClose={() => (enviando ? undefined : setConfirmando(null))}
        title="Enviar este aviso?"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirmando(null)} disabled={enviando}>
              Voltar
            </Button>
            <Button onClick={() => void enviar()} loading={enviando} disabled={!confirmando?.atletas}>
              <Send className="size-4" />
              {confirmando?.atletas
                ? `Enviar para ${plural(confirmando.atletas, escolhendo ? "pessoa" : "atleta")}`
                : "Ninguém para receber"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Previa titulo={titulo.trim()} corpo={corpo.trim()} />
          <p className="text-sm text-text-light">
            {escolhendo ? (
              <>
                Para: <strong className="text-text">{resumoNomes(nomesEscolhidos)}</strong>
              </>
            ) : (
              <>
                Público: <strong className="text-text">{PUBLICO_LABEL[publico]}</strong>
              </>
            )}{" "}
            · ao tocar abre{" "}
            <strong className="text-text">{DESTINOS_PUSH.find((d) => d.href === link)?.label}</strong>. Depois de enviado não
            dá para cancelar.
          </p>
        </div>
      </Modal>
    </div>
  );
}
