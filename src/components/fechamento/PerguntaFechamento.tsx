"use client";

import { useState } from "react";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { apiAutenticada } from "@/lib/apiCliente";
import { cn } from "@/lib/cn";
import { hojeBrasil } from "@/lib/calendarioPremiacao";
import { plural } from "@/lib/format";
import { DIAS_ATE_FECHAR_SOZINHO, fechaJuntoComOMes, mesParaConfirmar, textoDoFechamento, type MesesFechados, type TrimestreDoResumo } from "@/lib/resumoPeriodo";
import { Button } from "@/components/ui/Button";

const chaveAdiado = (competencia: string) => `fechamento-adiado:${competencia}`;

function adiado(competencia: string) {
  try {
    return window.sessionStorage.getItem(chaveAdiado(competencia)) === "1";
  } catch {
    return false;
  }
}

/**
 * No começo do mês, pergunta a quem lança pontos se o mês anterior está todo
 * lançado. Ao confirmar, os atletas recebem o resumo (sem confirmação, ele sai
 * sozinho no dia configurado pelo administrador). "Ainda não" esconde até a próxima visita.
 */
export function PerguntaFechamento({
  fechados,
  carregado,
  diasSozinho = DIAS_ATE_FECHAR_SOZINHO,
  trimestres,
  onFechado,
  variante = "faixa",
  className,
}: {
  fechados: MesesFechados;
  carregado: boolean;
  /** Dia do mês em que o resumo sai sozinho, se ninguém confirmar. */
  diasSozinho?: number;
  trimestres: readonly TrimestreDoResumo[];
  onFechado?: () => void;
  /** faixa: aviso no topo da Pontuação; painel: dentro do item do Início da gestão. */
  variante?: "faixa" | "painel";
  className?: string;
}) {
  const hoje = hojeBrasil();
  const mes = carregado ? mesParaConfirmar(hoje, fechados, diasSozinho) : null;
  const [adiouAgora, setAdiouAgora] = useState(false);
  const escondido = adiouAgora || (mes !== null && typeof window !== "undefined" && adiado(mes.competencia));
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<{ nome: string; avisados: number; depois: boolean } | null>(null);
  const [erro, setErro] = useState("");

  if (feito) {
    return (
      <div className={cn("flex items-start gap-3 rounded-[var(--radius-lg)] bg-success/10 p-4 text-sm", className)} role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-text">
          <span className="font-semibold">Mês de {feito.nome} fechado.</span>{" "}
          {feito.avisados > 0
            ? `${plural(feito.avisados, "atleta recebeu", "atletas receberam")} o resumo no celular.`
            : feito.depois
              ? "O resumo sai amanhã a partir das 8h, para ninguém receber de madrugada."
              : "Quem treinou no mês recebe o resumo no celular."}
        </p>
      </div>
    );
  }
  if (!mes || (variante === "faixa" && escondido)) return null;

  const doQue = textoDoFechamento(mes.nome, fechaJuntoComOMes(mes.competencia, trimestres));
  async function confirmar() {
    if (!mes) return;
    setErro("");
    setEnviando(true);
    try {
      const r = await apiAutenticada<{ avisados: number; depois: boolean }>("/api/fechamento-mes", { method: "POST", body: JSON.stringify({ competencia: mes.competencia }) });
      setFeito({ nome: mes.nome, avisados: r.avisados, depois: r.depois });
      onFechado?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível fechar o mês agora.");
    } finally {
      setEnviando(false);
    }
  }
  function adiar() {
    try {
      window.sessionStorage.setItem(chaveAdiado(mes!.competencia), "1");
    } catch {
      /* esconde só agora */
    }
    setAdiouAgora(true);
  }

  return (
    <div className={cn(variante === "faixa" && "rounded-[var(--radius-lg)] border border-primary/25 bg-primary-subtle/50 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <CalendarCheck2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text">Os lançamentos de {mes.nome} estão completos?</p>
          <p className="mt-0.5 text-sm text-text-light">
            Quando você confirmar, os atletas recebem o resumo {doQue} no celular. Se ninguém confirmar, ele sai sozinho no dia {diasSozinho}, às 10h.
          </p>
          {erro ? <p className="mt-2 text-sm font-medium text-danger">{erro}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void confirmar()} loading={enviando}>
              Sim, fechar {mes.nome} e avisar
            </Button>
            {variante === "faixa" ? (
              <Button size="sm" variant="ghost" onClick={adiar} disabled={enviando}>
                Ainda não
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
