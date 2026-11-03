"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAutenticada } from "@/lib/apiCliente";
import type { MesesFechados } from "@/lib/resumoPeriodo";

/**
 * Meses que o comitê confirmou como todo lançado. `carregado` false até a
 * primeira resposta: enquanto isso, nada de destaque nem de pergunta.
 */
export function useMesesFechados() {
  const [fechados, setFechados] = useState<MesesFechados>({});
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let ativo = true;
    apiAutenticada<{ fechados: MesesFechados }>("/api/fechamento-mes")
      .then((r) => ativo && setFechados(r.fechados ?? {}))
      .catch(() => undefined)
      .finally(() => ativo && setCarregado(true));
    return () => {
      ativo = false;
    };
  }, [versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { fechados, carregado, recarregar };
}
