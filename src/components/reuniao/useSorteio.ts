"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sortearEntre } from "@/lib/reuniaoResultados";

export interface PresenteSorteio {
  id: string;
  nome: string;
  equipe: string;
}

interface Rodadas {
  chave: string | null;
  ganhadores: string[];
  /** Nome passando na tela agora. */
  girando: string | null;
  revelado: string | null;
}
const vazio = (chave: string | null): Rodadas => ({ chave, ganhadores: [], girando: null, revelado: null });

/** Número aleatório em [0, 1) vindo do gerador criptográfico (justo e imprevisível). */
function aleatorio() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/**
 * Sorteio ao vivo entre quem registrou presença. Cada rodada passa nomes na tela
 * por ~3 s, desacelerando, e revela um ganhador que não concorre de novo.
 * Com "reduzir movimento" ligado, revela direto.
 */
export function useSorteio(presentes: readonly PresenteSorteio[] | null, chave: string | null) {
  const [estado, setEstado] = useState<Rodadas>(() => vazio(chave));
  const timers = useRef<number[]>([]);

  const limpar = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  // Desmontou ou trocou de reunião: para o que estiver girando.
  useEffect(() => limpar, [limpar, chave]);

  // Trocou de reunião: começa do zero (ajuste durante a renderização, sem efeito).
  if (estado.chave !== chave) setEstado(vazio(chave));
  const atual = estado;
  const lista = useMemo(() => presentes ?? [], [presentes]);
  const elegiveis = useMemo(() => lista.filter((p) => !atual.ganhadores.includes(p.id)), [lista, atual.ganhadores]);

  const sortear = useCallback(() => {
    if (atual.girando || elegiveis.length === 0) return;
    const ganhador = sortearEntre(elegiveis, aleatorio);
    if (!ganhador) return;
    limpar();
    const revelar = () =>
      setEstado((e) => (e.chave !== chave ? e : { ...e, ganhadores: [...e.ganhadores, ganhador.id], girando: null, revelado: ganhador.id }));
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduzir || elegiveis.length === 1) {
      revelar();
      return;
    }
    // Intervalos crescentes: começa rápido (60 ms) e freia até ~380 ms.
    let decorrido = 0;
    const passos = 22;
    for (let i = 0; i < passos; i++) {
      decorrido += 60 + Math.round((i / passos) ** 2 * 320);
      const nome = elegiveis[Math.floor(aleatorio() * elegiveis.length)].nome;
      timers.current.push(
        window.setTimeout(() => setEstado((e) => (e.chave !== chave ? e : { ...e, girando: nome })), decorrido),
      );
    }
    timers.current.push(window.setTimeout(revelar, decorrido + 420));
  }, [atual.girando, elegiveis, chave, limpar]);

  const recomecar = useCallback(() => {
    limpar();
    setEstado(vazio(chave));
  }, [chave, limpar]);

  const estadoTela = useMemo(
    () => ({ presentes: lista, ganhadores: atual.ganhadores, girando: atual.girando, revelado: atual.revelado }),
    [lista, atual.ganhadores, atual.girando, atual.revelado],
  );

  return {
    estado: estadoTela,
    sortear,
    recomecar,
    elegiveis: elegiveis.length,
    girando: !!atual.girando,
  };
}
