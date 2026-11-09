"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, getDocs } from "firebase/firestore";
import { CalendarClock, CopyCheck, RefreshCw, Scale, SearchCheck, ShieldCheck, UserX } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { temPermissao } from "@/lib/permissoes";
import { carregarTodosLancamentos, invalidarLancamentos } from "@/lib/lancamentosCache";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import { hojeBrasil, nomeDoMes } from "@/lib/calendarioPremiacao";
import { equipeLabel, tipoLancamentoLabel } from "@/lib/labels";
import { formatDataTreino, formatKm, formatKmTotal, formatPontos, plural } from "@/lib/format";
import {
  conferirPontos,
  detalharAtleta,
  quantidadeDePendencias,
  type CriterioDoMes,
  type GrupoRepetido,
  type LancamentoConferido,
  type ResumoConferido,
  type TotalDivergente,
} from "@/lib/conferenciaPontos";
import { corrigirTotais, estornarRepeticao, marcarRepeticaoConferida, marcarResumoConferido } from "@/lib/conferenciaOperacoes";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PainelNumeros } from "@/components/ui/PainelNumeros";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { useToast } from "@/components/ui/Toast";
import type { AtletaDoc, TipoLancamento } from "@/lib/types";

interface Dados {
  atletas: AtletaDoc[];
  publicos: Map<string, number>;
  lancamentos: LancamentoConferido[];
  resumos: ResumoConferido[];
}

const diferenca = (n: number) => `${n > 0 ? "+" : "−"}${formatPontos(Math.abs(n))}`;

/**
 * Conferência dos pontos: refaz a conta de cada atleta a partir do histórico e
 * mostra o que não bate. Nada muda sem o comitê confirmar.
 */
export function ConferenciaTab() {
  const { uid, atleta: eu, usuario } = useActiveSession();
  const autor = useMemo(() => ({ uid, nome: eu.nome }), [uid, eu.nome]);
  const podeResumo = temPermissao(usuario, "historicoMensal");
  const regrasTreino = useRegrasDeTreino();
  const { show } = useToast();

  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [confirmarTotais, setConfirmarTotais] = useState<TotalDivergente[] | null>(null);
  const [estornando, setEstornando] = useState<GrupoRepetido | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    // Sempre do banco: a conferência não pode usar uma cópia antiga dos lançamentos.
    invalidarLancamentos();
    try {
      const [atletasSnap, publicosSnap, lancamentos, resumosSnap] = await Promise.all([
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "atletas_publicos")),
        carregarTodosLancamentos(),
        getDocs(collection(db, "historico_mensal")),
      ]);
      setDados({
        atletas: atletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc),
        publicos: new Map(publicosSnap.docs.map((d) => [d.id, Number(d.data().pontuacaoTotal) || 0])),
        lancamentos: lancamentos as LancamentoConferido[],
        resumos: resumosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ResumoConferido),
      });
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(id);
  }, [carregar]);

  const resultado = useMemo(
    () =>
      dados && regrasTreino
        ? conferirPontos({
            atletas: dados.atletas.map((a) => ({ id: a.id, nome: a.nome, equipe: a.equipe, pontuacaoTotal: a.pontuacaoTotal })),
            publicos: dados.publicos,
            lancamentos: dados.lancamentos,
            resumos: dados.resumos,
            regrasTreino,
            hoje: hojeBrasil(),
          })
        : null,
    [dados, regrasTreino],
  );

  async function executar(chave: string, acao: () => Promise<unknown>, mensagem: string) {
    setOcupado(chave);
    try {
      await acao();
      show("success", mensagem);
      await carregar();
    } catch (e) {
      show("error", e instanceof Error && e.message ? e.message : "Não foi possível salvar agora. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function handleCorrigir() {
    if (!confirmarTotais) return;
    const lista = confirmarTotais;
    try {
      const r = await corrigirTotais(lista.map((t) => t.atletaId), autor);
      show(
        r.rankingAtualizado ? "success" : "info",
        `${r.corrigidos === 1 ? "1 total corrigido" : `${r.corrigidos} totais corrigidos`}.${r.rankingAtualizado ? "" : " O ranking não atualizou sozinho: use \"Recalcular agora\" em Configurações."}`,
      );
      setConfirmarTotais(null);
      await carregar();
    } catch (e) {
      show("error", e instanceof Error && e.message ? e.message : "Não foi possível corrigir agora. Tente de novo.");
    }
  }

  async function handleEstornar() {
    if (!estornando) return;
    const grupo = estornando;
    try {
      await estornarRepeticao(grupo, autor);
      show("success", grupo.lancamentos.length === 2 ? "Repetição estornada." : `${grupo.lancamentos.length - 1} repetições estornadas.`);
      setEstornando(null);
      await carregar();
    } catch (e) {
      show("error", e instanceof Error && e.message ? e.message : "Não foi possível estornar agora. Tente de novo.");
    }
  }

  const pendencias = resultado ? quantidadeDePendencias(resultado) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-extrabold text-text">Conferência dos pontos</h2>
          <p className="mt-0.5 text-sm text-text-light [text-wrap:pretty]">
            Refaz a conta de cada atleta a partir dos lançamentos e dos resumos mensais e mostra o que não bate. Nada muda sem você confirmar.
          </p>
        </div>
        <Button variant="secondary" className="shrink-0" onClick={() => void carregar()} loading={carregando && !!dados}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Conferir de novo
        </Button>
      </div>

      {erro ? (
        <InlineAlert tone="danger">Não foi possível carregar os lançamentos agora. Confira a conexão e toque em &quot;Conferir de novo&quot;.</InlineAlert>
      ) : null}

      {!resultado ? (
        erro ? null : <Card className="h-40 animate-pulse" aria-label="Conferindo" />
      ) : (
        <>
          <PainelNumeros
            itens={[
              { rotulo: "Atletas conferidos", valor: String(resultado.atletasConferidos) },
              { rotulo: "Lançamentos conferidos", valor: formatPontos(resultado.lancamentosConferidos) },
              {
                rotulo: "Para conferir",
                valor: String(pendencias),
                tom: pendencias === 0 ? "success" : "danger",
              },
            ]}
          />

          {pendencias === 0 ? (
            <Card>
              <EmptyState
                icon={ShieldCheck}
                title="Tudo certo com os pontos"
                description="O total de cada atleta bate com os lançamentos e os resumos mensais, e nenhum lançamento aparece repetido."
              />
            </Card>
          ) : null}

          {resultado.totais.length > 0 ? (
            <Secao
              icone={Scale}
              titulo="Total diferente do histórico"
              quantidade={resultado.totais.length}
              descricao="O total gravado no atleta (o que o ranking Geral mostra) não bate com a soma dos lançamentos e resumos mensais. Corrigir grava a soma do histórico como total e fica registrado na auditoria."
              rodape={
                <Button size="sm" onClick={() => setConfirmarTotais(resultado.totais)}>
                  {resultado.totais.length === 1 ? "Corrigir o total" : `Corrigir os ${resultado.totais.length} totais`}
                </Button>
              }
            >
              {resultado.totais.map((t) => (
                <Linha
                  key={t.atletaId}
                  titulo={t.nome}
                  detalhe={
                    t.salvoPublico !== null && t.salvoPublico !== t.salvo
                      ? `${equipeLabel[t.equipe]}. No ranking aparece ${formatPontos(t.salvoPublico)}`
                      : equipeLabel[t.equipe]
                  }
                >
                  <Comparacao itens={[["Gravado", formatPontos(t.salvo)], ["Pelo histórico", formatPontos(t.esperado)]]} destaque={diferenca(t.esperado - t.salvo)} />
                </Linha>
              ))}
            </Secao>
          ) : null}

          {resultado.repetidos.length > 0 ? (
            <Secao
              icone={CopyCheck}
              titulo="Lançado mais de uma vez"
              quantidade={resultado.repetidos.length}
              descricao="Mesmo atleta, mesmo critério e mesmo dia. Pode estar certo, como dois treinos no mesmo dia. Se for repetição, estorne a cópia: os pontos saem do total e o estorno fica no extrato."
            >
              {resultado.repetidos.map((g) => (
                <Linha
                  key={g.chave}
                  titulo={g.nome}
                  detalhe={`${g.descricao} em ${formatDataTreino(g.data)}, lançado ${g.lancamentos.length} vezes${quemLancou(g)}`}
                  acoes={
                    <>
                      <Button variant="ghost" size="sm" loading={ocupado === `ok-${g.chave}`} disabled={!!ocupado} onClick={() => void executar(`ok-${g.chave}`, () => marcarRepeticaoConferida(g, autor), "Marcado como certo. Não aparece mais aqui.")}>
                        Está certo
                      </Button>
                      <Button variant="secondary" size="sm" disabled={!!ocupado} onClick={() => setEstornando(g)}>
                        Estornar {g.lancamentos.length === 2 ? "a cópia" : "as cópias"}
                      </Button>
                    </>
                  }
                />
              ))}
            </Secao>
          ) : null}

          {resultado.mesesDuplos.length > 0 ? (
            <Secao
              icone={SearchCheck}
              titulo="Mês com resumo e lançamentos"
              quantidade={resultado.mesesDuplos.length}
              descricao="O mês tem um resumo no Histórico mensal e também lançamentos. Os dois somam: se o resumo já inclui esses treinos, eles contam duas vezes. Se o resumo cobre só a parte do mês sem lançamento, marque como certo; se não, ajuste o resumo no Histórico mensal."
            >
              {resultado.mesesDuplos.map((m) => (
                <Linha
                  key={m.chave}
                  titulo={m.nome}
                  detalhe={nomeDoMes(m.competencia)}
                  acoes={
                    podeResumo ? (
                      <Button variant="ghost" size="sm" loading={ocupado === `mes-${m.chave}`} disabled={!!ocupado} onClick={() => void executar(`mes-${m.chave}`, () => marcarResumoConferido(m.resumoId, autor), "Marcado como certo. Não aparece mais aqui.")}>
                        Está certo
                      </Button>
                    ) : null
                  }
                >
                  <Comparacao itens={[["No resumo", textoMes(m.resumo)], ["Em lançamentos", textoMes(m.lancamentos)]]} />
                </Linha>
              ))}
            </Secao>
          ) : null}

          {resultado.futuros.length > 0 ? (
            <Secao
              icone={CalendarClock}
              titulo="Data no futuro"
              quantidade={resultado.futuros.length}
              descricao="Lançamentos com data depois de hoje, quase sempre um ano ou mês digitado errado. Eles já contam no total. Corrija a data no Extrato."
            >
              {resultado.futuros.map((l) => (
                <Linha key={l.id} titulo={l.atletaNome} detalhe={`${l.regraDesc} em ${formatDataTreino(l.dataTreino)}, lançado por ${l.criadoPorNome || "alguém do comitê"}`} />
              ))}
            </Secao>
          ) : null}

          {resultado.semAtleta.lancamentos + resultado.semAtleta.resumos > 0 ? (
            <InlineAlert tone="info" icon={UserX}>
              {[
                resultado.semAtleta.lancamentos ? plural(resultado.semAtleta.lancamentos, "lançamento") : "",
                resultado.semAtleta.resumos ? plural(resultado.semAtleta.resumos, "resumo mensal", "resumos mensais") : "",
              ]
                .filter(Boolean)
                .join(" e ")}{" "}
              ({formatPontos(resultado.semAtleta.pontos)} pts) {resultado.semAtleta.lancamentos + resultado.semAtleta.resumos === 1 ? "é de um cadastro que" : "são de cadastros que"} não existem mais. Não contam para ninguém.
            </InlineAlert>
          ) : null}

          {dados && regrasTreino ? <ConferirAtleta dados={dados} regrasTreino={regrasTreino} /> : null}
        </>
      )}

      <ConfirmActionModal
        open={!!confirmarTotais}
        title={confirmarTotais?.length === 1 ? "Corrigir o total" : `Corrigir ${confirmarTotais?.length ?? 0} totais`}
        description={
          confirmarTotais?.length === 1
            ? `O total de ${confirmarTotais[0].nome} passa de ${formatPontos(confirmarTotais[0].salvo)} para ${formatPontos(confirmarTotais[0].esperado)} pontos, a soma do histórico. O ranking é atualizado em seguida.`
            : "Cada total passa a ser a soma do histórico do atleta, refeita na hora. O ranking é atualizado em seguida e tudo fica na auditoria."
        }
        confirmLabel="Corrigir"
        onClose={() => setConfirmarTotais(null)}
        onConfirm={handleCorrigir}
      />
      <ConfirmActionModal
        open={!!estornando}
        title={estornando && estornando.lancamentos.length > 2 ? "Estornar as cópias" : "Estornar a cópia"}
        description={
          estornando
            ? `Fica o primeiro lançamento de ${estornando.descricao} de ${estornando.nome} em ${formatDataTreino(estornando.data)}. ${estornando.lancamentos.length === 2 ? "A cópia sai" : "As cópias saem"} do total (−${formatPontos(estornando.pontosAMais)} pts) e o estorno fica no extrato.`
            : ""
        }
        confirmLabel="Estornar"
        onClose={() => setEstornando(null)}
        onConfirm={handleEstornar}
      />
    </div>
  );
}

function quemLancou(g: GrupoRepetido) {
  const nomes = [...new Set(g.lancamentos.map((l) => l.criadoPorNome).filter(Boolean))];
  if (!nomes.length) return "";
  return nomes.length === 1 ? ` por ${nomes[0]}` : ` por ${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function textoMes(v: { pontos: number; treinos: number }) {
  return `${formatPontos(v.pontos)} pts, ${plural(v.treinos, "treino")}`;
}

function Secao({
  icone: Icone,
  titulo,
  quantidade,
  descricao,
  rodape,
  children,
}: {
  icone: typeof Scale;
  titulo: string;
  quantidade: number;
  descricao: string;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padding="none">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-ranking-gold-text">
          <Icone className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-text">{titulo}</h3>
            <Badge tone="warning">{quantidade}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-text-light [text-wrap:pretty]">{descricao}</p>
        </div>
      </div>
      <ul className="divide-y divide-border border-t border-border">{children}</ul>
      {rodape ? <div className="flex justify-end border-t border-border px-4 py-3 sm:px-5">{rodape}</div> : null}
    </Card>
  );
}

function Linha({ titulo, detalhe, acoes, children }: { titulo: string; detalhe?: string; acoes?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{titulo}</p>
        {detalhe ? <p className="text-xs text-text-light [text-wrap:pretty]">{detalhe}</p> : null}
      </div>
      {children}
      {acoes ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{acoes}</div> : null}
    </li>
  );
}

function Comparacao({ itens, destaque }: { itens: [string, string][]; destaque?: string }) {
  return (
    <dl className="flex shrink-0 items-end gap-5 tabular-nums">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-xs text-text-light">{rotulo}</dt>
          <dd className="text-sm font-bold text-text">{valor}</dd>
        </div>
      ))}
      {destaque ? (
        <div>
          <dt className="text-xs text-text-light">Diferença</dt>
          <dd className="text-sm font-extrabold text-danger">{destaque}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/* ---------- Conferir um atleta, mês a mês ---------- */

/**
 * Se o critério contou como treino. Quando só parte contou, diz por quê: o
 * mesmo critério pode ter sido lançado como Treino numa vez e como Avulso ou
 * Evento em outra, e só o tipo Treino conta sempre.
 */
function ContagemDeTreino({ criterio: c }: { criterio: CriterioDoMes }) {
  if (c.contaram === 0 && !Object.keys(c.naoContaram).length) return null;
  if (c.contaram === c.vezes) return <span className="ml-2 text-xs text-text-light">conta como treino</span>;
  const motivos = (Object.entries(c.naoContaram) as [TipoLancamento, number][]).map(
    ([tipo, n]) => `${n} lançado${n === 1 ? "" : "s"} como ${tipoLancamentoLabel[tipo]}`,
  );
  if (c.contaram === 0) {
    // Nenhum contou: só vale apontar quando o nome sugere treino (ex.: "Treino extra").
    return /treino/i.test(c.descricao) ? (
      <span className="mt-0.5 block text-xs font-medium text-danger">Não contou como treino ({motivos.join(", ")})</span>
    ) : null;
  }
  return (
    <span className="mt-0.5 block text-xs font-medium text-danger">
      Contou como treino em {c.contaram} de {c.vezes}: {motivos.join(", ")}
    </span>
  );
}

function ConferirAtleta({ dados, regrasTreino }: { dados: Dados; regrasTreino: NonNullable<ReturnType<typeof useRegrasDeTreino>> }) {
  const atletas = useMemo(() => [...dados.atletas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [dados.atletas]);
  const [atletaId, setAtletaId] = useState("");
  const anos = useMemo(() => {
    const set = new Set<string>([hojeBrasil().slice(0, 4)]);
    for (const l of dados.lancamentos) if (l.atletaId === atletaId) set.add(l.dataTreino.slice(0, 4));
    for (const r of dados.resumos) if (r.atletaId === atletaId) set.add(r.competencia.slice(0, 4));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [dados, atletaId]);
  const [anoEscolhido, setAno] = useState("");
  const ano = anos.includes(anoEscolhido) ? anoEscolhido : anos[0];

  const meses = useMemo(
    () => (atletaId ? detalharAtleta(atletaId, dados.lancamentos, dados.resumos, ano, regrasTreino) : []),
    [atletaId, dados, ano, regrasTreino],
  );
  const total = meses.reduce((s, m) => ({ pontos: s.pontos + m.pontos, treinos: s.treinos + m.treinos, km: s.km + m.km }), { pontos: 0, treinos: 0, km: 0 });

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-text">Conferir um atleta</h3>
        <p className="mt-0.5 max-w-3xl text-sm text-text-light [text-wrap:pretty]">
          Mostra mês a mês de onde vêm os treinos e os pontos, critério por critério, para comparar com a planilha do comitê.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Select value={atletaId} onChange={(e) => setAtletaId(e.target.value)} placeholder="Escolha o atleta" searchable aria-label="Atleta">
          {atletas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>
        <Select value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano" disabled={!atletaId}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>

      {!atletaId ? null : meses.length === 0 ? (
        <p className="rounded-[var(--radius)] bg-bg-inset px-3.5 py-3 text-sm text-text-light">Nenhum lançamento nem resumo mensal em {ano}.</p>
      ) : (
        <>
          <PainelNumeros
            itens={[
              { rotulo: `Treinos em ${ano}`, valor: String(total.treinos) },
              { rotulo: `Pontos em ${ano}`, valor: formatPontos(total.pontos) },
              { rotulo: `Km em ${ano}`, valor: formatKmTotal(total.km) },
            ]}
          />
          <ol className="flex flex-col gap-3">
            {meses.map((m) => {
              const notas = [
                m.juntados > 0
                  ? `${plural(m.juntados, "critério")} de treino ${m.juntados === 1 ? "foi lançado" : "foram lançados"} junto com outro no mesmo dia: conta como um treino só, e os pontos somam`
                  : "",
                m.faltasJustificadas > 0 ? `${plural(m.faltasJustificadas, "falta justificada", "faltas justificadas")}, sem pontos` : "",
                m.estornados > 0 ? `${plural(m.estornados, "lançamento estornado", "lançamentos estornados")}, fora da conta` : "",
              ].filter(Boolean);
              return (
                <li key={m.competencia} className="rounded-[var(--radius-lg)] border border-border">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border bg-bg-inset/60 px-4 py-2.5">
                    <h4 className="text-sm font-bold text-text first-letter:uppercase">{nomeDoMes(m.competencia)}</h4>
                    <p className="text-sm tabular-nums text-text-secondary">
                      <span className="font-bold text-text">{plural(m.treinos, "treino")}</span>, {formatPontos(m.pontos)} pts{m.km > 0 ? `, ${formatKm(m.km)}` : ""}
                    </p>
                  </div>
                  <ul className="divide-y divide-border-subtle">
                    {m.criterios.map((c) => (
                      <li key={c.chave} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                        <span className="min-w-0 text-text">
                          {c.descricao}
                          <ContagemDeTreino criterio={c} />
                        </span>
                        <span className="shrink-0 tabular-nums text-text-secondary">
                          {c.vezes}× <span className="font-semibold text-text">{formatPontos(c.pontos)} pts</span>
                        </span>
                      </li>
                    ))}
                    {m.resumo ? (
                      <li className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                        <span className="text-text">Resumo do Histórico mensal</span>
                        <span className="shrink-0 tabular-nums text-text-secondary">
                          {plural(m.resumo.treinos, "treino")} <span className="font-semibold text-text">{formatPontos(m.resumo.pontos)} pts</span>
                        </span>
                      </li>
                    ) : null}
                  </ul>
                  {notas.length ? (
                    <ul className="flex flex-col gap-0.5 border-t border-border px-4 py-2 text-xs text-text-light">
                      {notas.map((n) => (
                        <li key={n}>{n}.</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}

