"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiAutenticada } from "@/lib/apiCliente";
import type { ComandoRemoto, EstadoRemoto, RespostaControle } from "@/lib/controleRemoto";

/**
 * Lado do notebook: abre a sessão, busca os comandos do celular a cada
 * 0,7 s e publica o estado (slide atual, próximo, anotação) quando muda.
 */
export function useControleRemoto(estado: EstadoRemoto, executar: (c: ComandoRemoto) => void) {
  const [sessao, setSessao] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const [ultimoComandoEm, setUltimoComandoEm] = useState<number | null>(null);
  const seq = useRef(0);
  const executarRef = useRef(executar);
  useEffect(() => {
    executarRef.current = executar;
  });

  const abrir = useCallback(async () => {
    setAbrindo(true);
    setErro("");
    try {
      const r = await apiAutenticada<{ sessao: string }>("/api/reuniao-controle", { method: "POST", body: JSON.stringify({ acao: "abrir" }) });
      seq.current = 0;
      setSessao(r.sessao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ligar o controle agora.");
    } finally {
      setAbrindo(false);
    }
  }, []);

  const fechar = useCallback(() => {
    setSessao((atual) => {
      if (atual) void apiAutenticada("/api/reuniao-controle", { method: "POST", body: JSON.stringify({ acao: "fechar", sessao: atual }) }).catch(() => undefined);
      return null;
    });
  }, []);

  // Busca comandos.
  useEffect(() => {
    if (!sessao) return;
    let vivo = true;
    let ocupado = false;
    const t = window.setInterval(async () => {
      if (ocupado) return;
      ocupado = true;
      try {
        const r = await apiAutenticada<RespostaControle>(`/api/reuniao-controle?sessao=${sessao}&depois=${seq.current}`);
        if (!vivo) return;
        if (r.encerrada) {
          setSessao(null);
          return;
        }
        for (const c of r.comandos) {
          seq.current = Math.max(seq.current, c.seq);
          executarRef.current(c.comando);
        }
        if (r.comandos.length) setUltimoComandoEm(Date.now());
        setErro("");
      } catch {
        if (vivo) setErro("Sem conexão com o controle. Tentando de novo…");
      } finally {
        ocupado = false;
      }
    }, 700);
    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, [sessao]);

  // Publica o estado quando muda.
  const chave = JSON.stringify(estado);
  useEffect(() => {
    if (!sessao) return;
    const t = window.setTimeout(() => {
      void apiAutenticada("/api/reuniao-controle", { method: "POST", body: JSON.stringify({ acao: "estado", sessao, estado: JSON.parse(chave) }) }).catch(() => undefined);
    }, 150);
    return () => window.clearTimeout(t);
  }, [sessao, chave]);

  // Fechou a apresentação: encerra a sessão.
  useEffect(() => () => fechar(), [fechar]);

  return { sessao, abrir, fechar, abrindo, erro, conectado: ultimoComandoEm !== null };
}
