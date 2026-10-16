"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Cake, PartyPopper, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { anosNoPrograma, comemoracoesDoAtleta, mensagemDaComemoracao } from "@/lib/comemoracoes";
import type { AtletaDoc } from "@/lib/types";

const CORES_CONFETE = ["bg-primary", "bg-secondary", "bg-accent", "bg-ranking-gold"];

function lerChave(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravarChave(chave: string) {
  try {
    window.localStorage.setItem(chave, "1");
  } catch {
    /* sem armazenamento: o cartão só volta a aparecer, sem prejuízo */
  }
}

/** Uma chuva curta de confete, só na primeira vez que o cartão aparece. */
function Confete() {
  const pecas = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: (i * 37) % 100,
        atraso: (i % 7) * 0.07,
        giro: (i % 2 ? 1 : -1) * (180 + ((i * 53) % 260)),
        cor: CORES_CONFETE[i % CORES_CONFETE.length],
        largura: i % 3 === 0 ? 10 : 6,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pecas.map((p, i) => (
        <motion.span
          key={i}
          className={cn("absolute top-0 block h-2 rounded-[2px]", p.cor)}
          style={{ left: `${p.x}%`, width: p.largura }}
          initial={{ y: -16, opacity: 1, rotate: 0 }}
          animate={{ y: 190, opacity: 0, rotate: p.giro }}
          transition={{ duration: 1.6, delay: p.atraso, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}

/**
 * Cartão de parabéns no Início: aniversário e aniversário de entrada na
 * equipe. Some quando o atleta fecha (vale para aquela data) e não aparece
 * para mais ninguém: as datas vêm do próprio cadastro.
 */
export function CartaoComemoracao({ atleta, hoje, className, somenteLeitura }: { atleta: AtletaDoc; hoje: string; className?: string; somenteLeitura?: boolean }) {
  const reduzir = useReducedMotion();
  const comemoracoes = useMemo(() => comemoracoesDoAtleta(atleta, hoje), [atleta, hoje]);
  const mensagem = mensagemDaComemoracao({ comemoracoes, nome: atleta.nome, equipe: atleta.equipe, anosNoPrograma: anosNoPrograma(atleta, hoje) });
  // Uma chave por data comemorada: fechar hoje não esconde o do ano que vem.
  const chave = `comemoracao:${atleta.id}:${comemoracoes.map((c) => `${c.tipo}-${c.data}`).join("+")}`;

  const [estado, setEstado] = useState<{ chave: string; fechado: boolean; confete: boolean } | null>(null);
  useEffect(() => {
    if (!comemoracoes.length) return;
    const id = window.setTimeout(() => {
      const fechado = !somenteLeitura && lerChave(chave) === "fechado";
      const jaViu = lerChave(`${chave}:visto`) === "1";
      if (!somenteLeitura && !jaViu) gravarChave(`${chave}:visto`);
      setEstado({ chave, fechado, confete: !jaViu });
    }, 0);
    return () => window.clearTimeout(id);
  }, [chave, comemoracoes.length, somenteLeitura]);

  if (!mensagem || !estado || estado.chave !== chave || estado.fechado) return null;
  const Icone = comemoracoes.some((c) => c.tipo === "aniversario") ? Cake : PartyPopper;

  function fechar() {
    if (!somenteLeitura) {
      try {
        window.localStorage.setItem(chave, "fechado");
      } catch {
        /* segue só nesta visita */
      }
    }
    setEstado((e) => (e ? { ...e, fechado: true } : e));
  }

  return (
    <motion.section
      aria-labelledby="comemoracao-titulo"
      initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-accent/25 bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5",
        className,
      )}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-accent/10 via-ranking-gold/5 to-transparent" aria-hidden="true" />
      {estado.confete && !reduzir ? <Confete /> : null}
      {/* No celular o texto ocupa a largura toda, abaixo do ícone e do título. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:items-start sm:gap-x-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm sm:row-span-2 sm:size-14">
          <Icone className="size-5 sm:size-7" aria-hidden="true" />
        </span>
        <h2 id="comemoracao-titulo" className="text-lg font-black leading-tight text-text [text-wrap:balance] sm:pt-1 sm:text-xl">
          {mensagem.titulo}
        </h2>
        <p className="col-span-3 max-w-2xl text-sm text-text-secondary [text-wrap:pretty] sm:col-span-1 sm:col-start-2 sm:row-start-2">{mensagem.texto}</p>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar mensagem"
          className="col-start-3 row-start-1 -mr-1 flex size-9 self-start shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </motion.section>
  );
}
