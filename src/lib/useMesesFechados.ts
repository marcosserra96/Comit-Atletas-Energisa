"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAutenticada } from "@/lib/apiCliente";
import { DIAS_ATE_FECHAR_SOZINHO, type MesesFechados } from "@/lib/resumoPeriodo";

/**
 * Meses que o comitê confirmou como todo lançado. `carregado` false até a
 * primeira resposta: enquanto isso, nada de destaque nem de pergunta.
 */
export function useMesesFechados() {
  const [fechados, setFechados] = useState<MesesFechados>({});
  /** Dia do mês em que o resumo sai sozinho, se ninguém confirmar (o administrador escolhe). */
  const [diasSozinho, setDiasSozinho] = useState(DIAS_ATE_FECHAR_SOZINHO);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let ativo = true;
    apiAutenticada<{ fechados: MesesFechados; diasAteFecharSozinho?: number }>("/api/fechamento-mes")
      .then((r) => {
        if (!ativo) return;
        setFechados(r.fechados ?? {});
        if (r.diasAteFecharSozinho) setDiasSozinho(r.diasAteFecharSozinho);
      })
      .catch(() => undefined)
      .finally(() => ativo && setCarregado(true));
    return () => {
      ativo = false;
    };
  }, [versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { fechados, carregado, diasSozinho, recarregar };
}
