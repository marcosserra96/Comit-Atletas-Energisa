"use client";

import { useState } from "react";
import { hojeBrasil } from "@/lib/calendarioPremiacao";
import { mesParaConfirmar } from "@/lib/resumoPeriodo";
import { useMesesFechados } from "@/lib/useMesesFechados";
import { useTrimestresDoCalendario } from "@/lib/useTrimestresDoCalendario";
import { Modal } from "@/components/ui/Modal";
import { fechamentoAdiado, PerguntaFechamento } from "./PerguntaFechamento";

/**
 * Logo depois de salvar pontos com data do mês anterior (ainda aberto), pergunta
 * se foram os últimos daquele mês: é a hora em que quem lança sabe a resposta.
 * Sim fecha o mês e avisa os atletas; "Ainda não" não pergunta de novo até a
 * próxima visita. `datas`: os dias lançados agora (null quando não há o que perguntar).
 */
export function PerguntaAposLancar({ datas, onFechar }: { datas: string[] | null; onFechar: () => void }) {
  const { fechados, carregado, diasSozinho, recarregar } = useMesesFechados();
  const trimestres = useTrimestresDoCalendario();
  // A resposta (sucesso) fica na tela até fechar, mesmo com o mês já fechado.
  const [respondeu, setRespondeu] = useState(false);
  const mes = carregado ? mesParaConfirmar(hojeBrasil(), fechados, diasSozinho) : null;
  const elegivel = !!datas && !!mes && datas.some((d) => d.startsWith(mes.competencia)) && !fechamentoAdiado(mes.competencia);

  function fechar() {
    if (respondeu) recarregar();
    setRespondeu(false);
    onFechar();
  }

  return (
    <Modal open={!!datas && (elegivel || respondeu)} onClose={fechar} title="Fechamento do mês" size="md" mobileSheet>
      <PerguntaFechamento
        variante="painel"
        fechados={fechados}
        carregado={carregado}
        diasSozinho={diasSozinho}
        trimestres={trimestres}
        pergunta="Esses foram os últimos lançamentos de {mes}?"
        onFechado={() => setRespondeu(true)}
        onAdiar={fechar}
      />
    </Modal>
  );
}
