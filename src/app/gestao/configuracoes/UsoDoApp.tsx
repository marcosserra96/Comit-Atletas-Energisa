"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Copy, RefreshCw, Search, Users } from "lucide-react";
import { apiAutenticada } from "@/lib/apiCliente";
import { cn } from "@/lib/cn";
import { equipeLabel } from "@/lib/labels";
import { plural } from "@/lib/format";
import { FAIXAS_USO, faixaDeUso, mensagemDeConvite, participaDoPrograma, resumoDeUso, textoUltimoUso, type FaixaUso, type PessoaUso } from "@/lib/usoDoApp";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useToast } from "@/components/ui/Toast";
import { AvatarPessoa } from "@/components/atletas/AvatarAtleta";
import { LembreteParados } from "../LembreteParados";

type Publico = "programa" | "fila" | "comite" | "todos";

const ORDEM_FAIXAS: FaixaUso[] = ["semana", "mes", "sumido", "nunca"];
/** Cor de cada faixa: do uso recente ao nenhum uso (as mesmas na barra e nos cartões). */
const COR: Record<FaixaUso, string> = { semana: "bg-success", mes: "bg-primary", sumido: "bg-warning", nunca: "bg-text-muted/50" };

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function noPublico(p: PessoaUso, publico: Publico) {
  if (publico === "todos") return true;
  if (publico === "programa") return p.ativo && participaDoPrograma(p.equipe, false);
  if (publico === "fila") return p.equipe === "fila_corrida" || p.equipe === "fila_bicicleta";
  return !participaDoPrograma(p.equipe, true);
}

/**
 * Quem usa o portal e quem ainda não entrou. O último uso vem das contas do
 * login (última renovação de sessão ou último login), lido na hora pelo servidor.
 */
export function UsoDoApp() {
  const { show } = useToast();
  const [pessoas, setPessoas] = useState<PessoaUso[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [publico, setPublico] = useState<Publico>("programa");
  const [faixa, setFaixa] = useState<FaixaUso | null>(null);
  const [busca, setBusca] = useState("");
  const [acesso, setAcesso] = useState<"todos" | "com" | "sem">("todos");
  const [agora, setAgora] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await apiAutenticada<{ pessoas: PessoaUso[]; geradoEm: string }>("/api/admin/uso-do-app");
      setPessoas(r.pessoas);
      setAgora(new Date(r.geradoEm).getTime());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar o uso do portal.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(id);
  }, [carregar]);

  const doPublico = useMemo(() => (pessoas ?? []).filter((p) => noPublico(p, publico)), [pessoas, publico]);
  const resumo = useMemo(() => resumoDeUso(doPublico, agora), [doPublico, agora]);
  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    return doPublico
      .filter((p) => !faixa || faixaDeUso(p, agora) === faixa)
      .filter((p) => acesso === "todos" || (acesso === "com") === p.temConta)
      .filter((p) => !termo || normalizar(`${p.nome} ${p.email ?? ""}`).includes(termo))
      .sort((a, b) => {
        // Quem usou por último primeiro; quem nunca entrou no fim, em ordem alfabética.
        const ua = a.temConta && a.ultimoUso ? Date.parse(a.ultimoUso) : -1;
        const ub = b.temConta && b.ultimoUso ? Date.parse(b.ultimoUso) : -1;
        return ub - ua || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [doPublico, faixa, busca, agora, acesso]);

  const sumidosComAviso = faixa === "sumido" ? lista.filter((p) => p.notificacoes).map((p) => p.atletaId) : [];
  const urlPortal = typeof window === "undefined" ? "" : window.location.origin;

  async function copiar(texto: string, mensagem: string) {
    try {
      await navigator.clipboard.writeText(texto);
      show("success", mensagem);
    } catch {
      show("error", "Não deu para copiar. Tente de novo.");
    }
  }

  if (erro && !pessoas) {
    return (
      <Card>
        <InlineAlert tone="danger">{erro}</InlineAlert>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void carregar()}>
          Tentar de novo
        </Button>
      </Card>
    );
  }
  if (!pessoas) return <Card className="h-64 animate-pulse" aria-label="Carregando o uso do portal" />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-text">Uso do portal</h3>
            <p className="mt-0.5 max-w-2xl text-sm text-text-light [text-wrap:pretty]">
              Quem abriu o portal e quando, pela sessão de login. Toque num grupo para ver quem está nele.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Select value={publico} onChange={(e) => { setPublico(e.target.value as Publico); setFaixa(null); }} aria-label="Quem mostrar" className="sm:w-48">
              <option value="programa">Atletas ativos</option>
              <option value="fila">Fila de espera</option>
              <option value="comite">Comitê</option>
              <option value="todos">Todos os cadastros</option>
            </Select>
            <Button variant="ghost" size="sm" className="h-11" onClick={() => void carregar()} loading={carregando} aria-label="Atualizar">
              <RefreshCw className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Totais: quantos cadastros, quantos já têm login e quantos ainda não. */}
        <dl className="grid grid-cols-3 divide-x divide-border rounded-[var(--radius-lg)] bg-bg-inset/60 py-3">
          {[
            { rotulo: "Total", valor: resumo.total, detalhe: plural(resumo.total, "cadastro") },
            { rotulo: "Com login ativo", valor: resumo.comLogin, detalhe: resumo.total ? `${Math.round((resumo.comLogin / resumo.total) * 100)}% do total` : "" },
            { rotulo: "Sem login", valor: resumo.semLogin, detalhe: resumo.semLogin ? "ainda não entraram" : "todos já entraram" },
          ].map((i) => (
            <div key={i.rotulo} className="flex flex-col items-center gap-0.5 px-2 text-center">
              <dt className="text-xs font-semibold text-text-secondary">{i.rotulo}</dt>
              <dd className="text-2xl font-extrabold tabular-nums text-text sm:text-3xl">{i.valor}</dd>
              <dd className="text-[11px] text-text-light">{i.detalhe}</dd>
            </div>
          ))}
        </dl>

        {/* Proporção de cada grupo: uma barra só, na mesma ordem dos cartões. */}
        {resumo.total > 0 ? (
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={ORDEM_FAIXAS.map((f) => `${FAIXAS_USO[f].rotulo}: ${resumo[f]}`).join(", ")}>
            {ORDEM_FAIXAS.filter((f) => resumo[f] > 0).map((f) => (
              <span key={f} className={cn("h-full", COR[f])} style={{ width: `${(resumo[f] / resumo.total) * 100}%` }} />
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {ORDEM_FAIXAS.map((f) => {
            const ativo = faixa === f;
            const pct = resumo.total ? Math.round((resumo[f] / resumo.total) * 100) : 0;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFaixa(ativo ? null : f)}
                aria-pressed={ativo}
                className={cn(
                  "flex flex-col gap-1 rounded-[var(--radius-lg)] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  ativo ? "border-primary bg-primary-subtle" : "border-border hover:bg-bg-inset/60",
                )}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                  <span className={cn("size-2.5 rounded-full", COR[f])} aria-hidden="true" />
                  {FAIXAS_USO[f].rotulo}
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-text">
                  {resumo[f]}
                  <span className="ml-1.5 text-sm font-semibold text-text-light">{pct}%</span>
                </span>
                <span className="text-xs text-text-light [text-wrap:pretty]">{FAIXAS_USO[f].descricao}</span>
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-text-light">
          <BellRing className="size-3.5" aria-hidden="true" />
          {resumo.notificacoes} de {resumo.total} recebem notificações no celular.
        </p>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-text">{faixa ? FAIXAS_USO[faixa].rotulo : acesso === "com" ? "Com acesso" : acesso === "sem" ? "Sem acesso" : "Todos"}</h3>
            <p className="text-xs text-text-light">{plural(lista.length, "pessoa")}</p>
          </div>
          <SegmentedControl
            value={acesso}
            onChange={(v) => setAcesso(v as typeof acesso)}
            className="w-full lg:w-auto [&>button]:flex-1 [&>button]:whitespace-nowrap"
            options={[
              { value: "todos", label: "Todos" },
              { value: "com", label: "Com acesso" },
              { value: "sem", label: "Sem acesso" },
            ]}
          />
          <div className="w-full lg:max-w-60">
            <TextField aria-label="Buscar por nome ou e-mail" icon={<Search className="size-[18px]" />} placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} type="search" />
          </div>
        </div>

        {faixa === "nunca" && lista.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border bg-bg-inset/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-text-secondary [text-wrap:pretty]">Mande o convite no grupo ou para cada pessoa: ele explica como pedir o acesso.</p>
            <Button variant="secondary" size="sm" className="shrink-0" onClick={() => void copiar(mensagemDeConvite("pessoal", urlPortal), "Convite para o grupo copiado.")}>
              <Copy className="size-4" aria-hidden="true" />
              Copiar convite para o grupo
            </Button>
          </div>
        ) : null}
        {faixa === "sumido" && sumidosComAviso.length > 0 ? (
          <div className="border-b border-border p-4 sm:px-5">
            <LembreteParados atletaIds={sumidosComAviso} />
          </div>
        ) : null}

        {lista.length === 0 ? (
          <EmptyState icon={Users} title={busca ? "Ninguém encontrado" : "Ninguém neste grupo"} description={busca ? "Confira o nome digitado." : "Nenhuma pessoa com esse filtro."} />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {lista.map((p) => {
              const f = faixaDeUso(p, agora);
              return (
                <li key={p.atletaId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <AvatarPessoa pessoa={{ id: p.atletaId, fotoVersao: p.fotoVersao }} nome={p.nome} className="size-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{p.nome}</p>
                    <p className="truncate text-xs text-text-light">
                      {equipeLabel[p.equipe] ?? "Comitê"}
                      {p.ativo ? "" : ", inativo"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                      <span className={cn("size-2 rounded-full", COR[f])} aria-hidden="true" />
                      {textoUltimoUso(p, agora)}
                    </span>
                    {p.notificacoes ? (
                      <span className="flex items-center gap-1 text-[11px] text-text-light">
                        <BellRing className="size-3" aria-hidden="true" />
                        Notificações ativas
                      </span>
                    ) : null}
                    {!p.temConta ? (
                      <button type="button" onClick={() => void copiar(mensagemDeConvite(p.nome, urlPortal), `Convite para ${p.nome.split(" ")[0]} copiado.`)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <Copy className="size-3" aria-hidden="true" />
                        Copiar convite
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
