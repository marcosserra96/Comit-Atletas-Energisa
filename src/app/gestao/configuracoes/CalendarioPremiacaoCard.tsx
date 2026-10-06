"use client";

import { useEffect, useId, useState } from "react";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { CalendarPlus, CalendarRange, EyeOff, Plus, Save, Trash2, Trophy } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import {
  CALENDARIO_PADRAO,
  DIAS_OCULTOS_MAXIMO,
  gerarTrimestresDoAno,
  hojeBrasil,
  janelaDaPremiacao,
  normalizarCalendario,
  ordenarTrimestres,
  planoDoCalendario,
  somarDias,
  trimestreVigente,
  validarCalendario,
  type CalendarioPremiacaoDoc,
  type TrimestreCalendario,
} from "@/lib/calendarioPremiacao";

function situacao(t: TrimestreCalendario, vigenteId: string | null, hoje: string) {
  if (t.id === vigenteId) {
    return hoje > t.fim
      ? { texto: "Aguardando premiação", classe: "bg-warning-subtle text-warning", dica: null }
      : { texto: "Valendo no ranking", classe: "bg-success-subtle text-success", dica: null };
  }
  if (t.inicio > hoje) return { texto: "Próximo", classe: "bg-primary-subtle text-primary", dica: null };
  if (hoje <= t.fim) {
    // Já começou, mas o anterior ainda espera a premiação.
    return {
      texto: "Em andamento",
      classe: "bg-primary-subtle text-primary",
      dica: "Os pontos já contam; aparece no ranking depois da premiação anterior.",
    };
  }
  return { texto: "Encerrado", classe: "bg-bg-inset text-text-muted", dica: null };
}

/**
 * Calendário anual: trimestres, premiações e quantos dias antes o ranking some.
 * Ao salvar, o servidor aplica na hora; depois o agendador mantém em dia.
 */
export function CalendarioPremiacaoCard({
  onAtivoSalvo,
  onAplicado,
}: {
  onAtivoSalvo: (ativo: boolean) => void;
  /** Depois de salvar e aplicar (para os outros cards recarregarem). */
  onAplicado?: () => void;
}) {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const idDias = useId();
  const idMensagem = useId();
  const [cal, setCal] = useState<CalendarioPremiacaoDoc>(CALENDARIO_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "configuracoes", "calendario_premiacao"))
      .then((snap) => {
        const valor = normalizarCalendario(snap.data() as Partial<CalendarioPremiacaoDoc> | undefined);
        setCal({ ...valor, trimestres: ordenarTrimestres(valor.trimestres) });
        onAtivoSalvo(valor.ativo);
      })
      .catch(() => show("error", "Não foi possível carregar o calendário de premiação."))
      .finally(() => setCarregando(false));
  }, [show, onAtivoSalvo]);

  const hoje = hojeBrasil();
  const validacao = validarCalendario(cal);
  const temErro = Object.keys(validacao.porTrimestre).length > 0 || validacao.geral !== null;
  const plano = planoDoCalendario(cal, hoje);
  const vigente = trimestreVigente(cal, hoje);

  function atualizar(id: string, campos: Partial<TrimestreCalendario>) {
    setCal((c) => ({ ...c, trimestres: c.trimestres.map((t) => (t.id === id ? { ...t, ...campos } : t)) }));
  }

  function remover(id: string) {
    setCal((c) => ({ ...c, trimestres: c.trimestres.filter((t) => t.id !== id) }));
  }

  function adicionar() {
    setCal((c) => {
      const ultimo = ordenarTrimestres(c.trimestres).at(-1);
      const inicio = ultimo?.fim ? somarDias(ultimo.fim, 1) : `${hoje.slice(0, 4)}-01-01`;
      return {
        ...c,
        trimestres: [...c.trimestres, { id: `t${Date.now()}`, nome: "", inicio, fim: "", premiacao: "" }],
      };
    });
  }

  const anosCadastrados = new Set(cal.trimestres.map((t) => t.inicio.slice(0, 4)));
  const anoAtual = Number(hoje.slice(0, 4));
  const anoParaGerar = anosCadastrados.has(String(anoAtual)) ? anoAtual + 1 : anoAtual;

  function gerarAno() {
    setCal((c) => ({ ...c, trimestres: ordenarTrimestres([...c.trimestres, ...gerarTrimestresDoAno(anoParaGerar)]) }));
  }

  async function salvar() {
    setTentouSalvar(true);
    if (temErro) {
      show("info", validacao.geral ?? "Corrija os trimestres marcados antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const dados: CalendarioPremiacaoDoc = {
        ativo: cal.ativo,
        diasOcultos: cal.diasOcultos,
        mensagem: cal.mensagem.trim(),
        trimestres: ordenarTrimestres(cal.trimestres).map((t) => ({ ...t, nome: t.nome.trim() })),
      };
      const batch = writeBatch(db);
      batch.set(doc(db, "configuracoes", "calendario_premiacao"), {
        ...dados,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: uid,
      });
      addAuditToBatch(batch, {
        acao: "calendario_premiacao_atualizado",
        entidade: "configuracoes",
        entidadeId: "calendario_premiacao",
        dados: { ativo: dados.ativo, diasOcultos: dados.diasOcultos, trimestres: dados.trimestres.length },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      await batch.commit();
      setCal(dados);
      onAtivoSalvo(dados.ativo);

      if (dados.ativo) {
        const user = auth.currentUser;
        const resposta = await fetch("/api/ranking/calendario", {
          method: "POST",
          headers: { Authorization: `Bearer ${await user?.getIdToken()}` },
        });
        if (!resposta.ok) throw new Error("aplicar");
        show("success", "Calendário salvo e aplicado ao ranking.");
        onAplicado?.();
      } else {
        show("success", "Calendário salvo. Ele está desligado: valem as configurações manuais.");
      }
    } catch (e) {
      show(
        "error",
        e instanceof Error && e.message === "aplicar"
          ? "O calendário foi salvo, mas não deu para aplicar agora. O sistema tenta de novo em alguns minutos."
          : "Não foi possível salvar o calendário. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Card className="h-64 animate-pulse" />;

  return (
    <Card className={cn(cal.ativo && "border-ranking-gold/40")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ranking-gold-bg text-ranking-gold-text">
            <CalendarRange className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text">Calendário de premiação</h3>
            <p className="mt-1 text-xs leading-relaxed text-text-light">
              Cadastre os trimestres do ano e as datas de premiação. O portal troca o trimestre do ranking e
              esconde o ranking dos atletas sozinho, nas datas certas.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Usar o calendário de premiação"
          aria-checked={cal.ativo}
          onClick={() => setCal((c) => ({ ...c, ativo: !c.ativo }))}
          className="flex min-h-11 min-w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className={cn("relative h-7 w-12 rounded-full transition-colors", cal.ativo ? "bg-primary" : "bg-border")}>
            <span
              className={cn(
                "absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform",
                cal.ativo ? "translate-x-5" : "translate-x-0",
              )}
            />
          </span>
        </button>
      </div>

      {cal.ativo ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-bg-inset p-3">
            <Trophy className="mt-0.5 size-4 shrink-0 text-ranking-gold-text" aria-hidden="true" />
            <p className="text-xs text-text-light">
              <span className="block font-semibold text-text">Vale agora</span>
              {vigente
                ? `${vigente.nome || "Sem nome"} · ${hoje > vigente.fim ? "aguardando a premiação" : `até ${formatShortDate(vigente.fim)}`}`
                : "Nenhum trimestre em andamento hoje"}
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-bg-inset p-3">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <p className="text-xs text-text-light">
              <span className="block font-semibold text-text">
                {plano.oculto ? "Ranking oculto agora" : "Próxima ocultação"}
              </span>
              {plano.ocultacao
                ? `${formatShortDate(plano.ocultacao.inicio)} a ${formatShortDate(plano.ocultacao.fim)} · ${plano.ocultacao.trimestreNome}`
                : cal.diasOcultos > 0
                  ? "Nenhuma: falta a data de premiação"
                  : "Desligada (0 dias)"}
            </p>
          </div>
        </div>
      ) : null}

      <div className={cn("mt-4 flex flex-col gap-4", !cal.ativo && "opacity-60")} aria-disabled={!cal.ativo}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idDias} className="text-sm font-medium text-text">
              Ocultar o ranking
            </label>
            <div className="flex items-center gap-2">
              <input
                id={idDias}
                type="number"
                inputMode="numeric"
                min={0}
                max={DIAS_OCULTOS_MAXIMO}
                value={cal.diasOcultos}
                disabled={!cal.ativo}
                onChange={(e) =>
                  setCal((c) => ({
                    ...c,
                    diasOcultos: Math.min(DIAS_OCULTOS_MAXIMO, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  }))
                }
                className="h-11 w-20 rounded-[var(--radius)] border border-border bg-bg px-3 text-center text-base tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
              />
              <span className="text-sm text-text-light">dias antes da premiação</span>
            </div>
            <p className="text-xs text-text-muted">Volta a aparecer no dia seguinte à premiação.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idMensagem} className="text-sm font-medium text-text">
              Mensagem para os atletas
            </label>
            <textarea
              id={idMensagem}
              rows={2}
              maxLength={240}
              value={cal.mensagem}
              disabled={!cal.ativo}
              onChange={(e) => setCal((c) => ({ ...c, mensagem: e.target.value }))}
              className="w-full resize-none rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text">Trimestres</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={gerarAno} disabled={!cal.ativo}>
                <CalendarPlus className="size-4" aria-hidden="true" />
                Gerar trimestres de {anoParaGerar}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={adicionar} disabled={!cal.ativo}>
                <Plus className="size-4" aria-hidden="true" />
                Adicionar
              </Button>
            </div>
          </div>

          {cal.trimestres.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-dashed border-border p-5 text-center text-sm text-text-light">
              Nenhum trimestre cadastrado. Use “Gerar trimestres de {anoParaGerar}” para começar com os 4 do ano e
              depois informe as datas de premiação.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cal.trimestres.map((t) => {
                const janela = janelaDaPremiacao(t, cal.diasOcultos);
                const erro = tentouSalvar || t.nome ? validacao.porTrimestre[t.id] : undefined;
                const s = situacao(t, vigente?.id ?? null, hoje);
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "rounded-[var(--radius)] border p-3",
                      t.id === vigente?.id ? "border-success/40 bg-success-subtle/40" : "border-border",
                      erro && "border-danger/40",
                    )}
                  >
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] md:items-end">
                      <div className="col-span-2 md:col-span-1">
                        <TextField
                          label="Nome"
                          value={t.nome}
                          placeholder="Ex.: 1º trimestre 2027"
                          disabled={!cal.ativo}
                          onChange={(e) => atualizar(t.id, { nome: e.target.value })}
                        />
                      </div>
                      <TextField label="Início" type="date" value={t.inicio} disabled={!cal.ativo} onChange={(e) => atualizar(t.id, { inicio: e.target.value })} />
                      <TextField label="Fim" type="date" value={t.fim} min={t.inicio || undefined} disabled={!cal.ativo} onChange={(e) => atualizar(t.id, { fim: e.target.value })} />
                      <TextField
                        label="Premiação"
                        type="date"
                        value={t.premiacao}
                        min={t.inicio || undefined}
                        disabled={!cal.ativo}
                        onChange={(e) => atualizar(t.id, { premiacao: e.target.value })}
                      />
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => remover(t.id)}
                          disabled={!cal.ativo}
                          aria-label={`Remover ${t.nome || "trimestre"}`}
                          className="flex size-11 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:pointer-events-none"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 font-bold", s.classe)}>{s.texto}</span>
                      {erro ? (
                        <span className="font-medium text-danger">{erro}</span>
                      ) : janela ? (
                        <span className="text-text-light">
                          Ranking oculto de <strong className="text-text">{formatShortDate(janela.inicio)}</strong> a{" "}
                          <strong className="text-text">{formatShortDate(janela.fim)}</strong>
                        </span>
                      ) : (
                        <span className="text-text-muted">
                          {t.premiacao ? "Sem ocultação (0 dias)" : "Sem data de premiação: o ranking não será ocultado"}
                        </span>
                      )}
                      {s.dica && !erro ? <span className="w-full text-text-muted">{s.dica}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <p className="text-xs text-text-muted">
          {cal.ativo
            ? "Depois de um trimestre, ele segue valendo até a premiação, para a conferência do resultado final."
            : "Desligado: valem o trimestre e as ocultações configurados manualmente abaixo."}
        </p>
        <Button onClick={salvar} loading={salvando} className="shrink-0">
          <Save className="size-4" aria-hidden="true" />
          Salvar calendário
        </Button>
      </div>
    </Card>
  );
}
