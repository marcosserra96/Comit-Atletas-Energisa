"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MonitorX, Sparkles } from "lucide-react";
import { RequireRole } from "@/components/session/RequireRole";
import { apiAutenticada } from "@/lib/apiCliente";
import { cn } from "@/lib/cn";
import type { ComandoRemoto, RespostaControle } from "@/lib/controleRemoto";

/** Controle remoto da apresentação, no celular de quem é do comitê. */
function Controle({ sessao }: { sessao: string }) {
  const [dados, setDados] = useState<RespostaControle | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState<ComandoRemoto | null>(null);
  const seq = useRef(0);

  const ler = useCallback(async () => {
    try {
      const r = await apiAutenticada<RespostaControle>(`/api/reuniao-controle?sessao=${sessao}&depois=${Number.MAX_SAFE_INTEGER}`);
      seq.current = r.seq;
      setDados(r);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Sem conexão.");
    }
  }, [sessao]);

  useEffect(() => {
    // Avisa a apresentação que o celular entrou.
    void apiAutenticada("/api/reuniao-controle", { method: "POST", body: JSON.stringify({ acao: "comando", sessao, comando: "ola" }) }).catch(() => undefined);
    const primeira = window.setTimeout(() => void ler(), 0);
    const t = window.setInterval(() => void ler(), 1000);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(t);
    };
  }, [sessao, ler]);

  async function enviar(comando: ComandoRemoto) {
    setEnviando(comando);
    navigator.vibrate?.(15);
    try {
      await apiAutenticada("/api/reuniao-controle", { method: "POST", body: JSON.stringify({ acao: "comando", sessao, comando }) });
      window.setTimeout(() => void ler(), 900);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(null);
    }
  }

  const estado = dados?.estado ?? null;
  if (dados?.encerrada) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0b1220] p-6 text-center text-white">
        <MonitorX className="size-10 text-white/60" aria-hidden="true" />
        <p className="text-lg font-bold">A apresentação foi encerrada</p>
        <p className="text-sm text-white/60">Para controlar de novo, ligue o controle na apresentação e leia o QR code outra vez.</p>
      </main>
    );
  }

  const botao = "flex items-center justify-center rounded-3xl font-bold transition-transform active:scale-[0.97] disabled:opacity-40";
  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-[#0b1220] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white">
      <header className="pt-2">
        <p className="text-xs font-semibold text-white/50">Controle da apresentação</p>
        <p className="mt-1 text-xl font-black leading-tight">{estado ? estado.rotulo : "Conectando…"}</p>
        {estado ? (
          <p className="mt-1 text-sm tabular-nums text-white/60">
            {estado.indice + 1} / {estado.total} · Próximo: {estado.proximo}
          </p>
        ) : null}
        {erro ? <p className="mt-2 text-sm font-semibold text-[#ffb18a]" role="alert">{erro}</p> : null}
      </header>

      {estado?.nota ? (
        <section className="max-h-[30dvh] overflow-y-auto rounded-2xl bg-white/5 p-4 text-base leading-relaxed text-white/90">
          <p className="mb-1 text-xs font-semibold text-white/50">Anotações</p>
          <p className="whitespace-pre-wrap">{estado.nota}</p>
        </section>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        {estado?.acao ? (
          <button type="button" onClick={() => void enviar("acao")} disabled={estado.acao.desabilitado || enviando !== null} className={cn(botao, "h-16 gap-2 bg-[#f37021] text-lg")}>
            <Sparkles className="size-5" aria-hidden="true" />
            {estado.acao.rotulo}
          </button>
        ) : null}
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <button type="button" onClick={() => void enviar("anterior")} disabled={!estado || enviando !== null} className={cn(botao, "h-40 bg-white/10 text-lg")} aria-label="Voltar">
            <ChevronLeft className="size-10" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => void enviar("proximo")} disabled={!estado || enviando !== null} className={cn(botao, "h-40 gap-2 bg-[#00809d] text-2xl")} aria-label="Avançar">
            Avançar
            <ChevronRight className="size-10" aria-hidden="true" />
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ControlePage({ params }: { params: Promise<{ sessao: string }> }) {
  const { sessao } = use(params);
  return (
    <RequireRole roles={["administrador", "comite"]}>
      <Controle sessao={sessao} />
    </RequireRole>
  );
}
