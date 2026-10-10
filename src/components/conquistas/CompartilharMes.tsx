"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { getStoredBranding } from "@/lib/branding";
import { dataIsoLocal } from "@/lib/date";
import { calcularResultadosRanking } from "@/lib/rankingPeriods";
import type { RegrasDeTreino } from "@/lib/activityConsolidation";
import type { MedalhaDoAtleta } from "@/lib/conquistas";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CARTAO_A, CARTAO_L, CartaoDoMes, type DadosCartaoDoMes } from "./CartaoDoMes";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function intervaloDoMes(deslocamento: 0 | -1) {
  const hoje = dataIsoLocal();
  const d = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 + deslocamento, 1);
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const iso = (dia: number) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return { inicio: iso(1), fim: deslocamento === 0 ? hoje : iso(ultimo), mes: MESES[mes], ano: String(ano) };
}

/** Escala o cartão 1080 × 1920 para caber na largura da janela. */
function Previa({ children }: { children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / CARTAO_L);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={caixa} className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)]" style={{ aspectRatio: `${CARTAO_L} / ${CARTAO_A}` }}>
      {escala > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: "top left" }}>{children}</div>
      ) : null}
    </div>
  );
}

/** Gera o story do mês do atleta e manda para o WhatsApp/Instagram (ou baixa). */
export function CompartilharMes({
  aberto,
  onFechar,
  atleta,
  modalidade,
  foto,
  lancamentos,
  historicoMensal,
  regrasTreino,
  semanas,
  medalhas,
  posicaoTrimestre,
}: {
  aberto: boolean;
  onFechar: () => void;
  atleta: AtletaDoc;
  modalidade: Modalidade;
  foto?: string;
  lancamentos: HistoricoPontoDoc[];
  historicoMensal: HistoricoMensalDoc[];
  regrasTreino: RegrasDeTreino | null;
  semanas: number;
  medalhas: MedalhaDoAtleta[];
  posicaoTrimestre: number | null;
}) {
  const { show } = useToast();
  const cartao = useRef<HTMLDivElement>(null);
  const [qual, setQual] = useState<"este" | "passado">(() => (Number(dataIsoLocal().slice(8, 10)) <= 5 ? "passado" : "este"));
  const [gerando, setGerando] = useState<"compartilhar" | "baixar" | null>(null);

  const dados = useMemo<DadosCartaoDoMes>(() => {
    const periodo = intervaloDoMes(qual === "este" ? 0 : -1);
    // Mesmo cálculo do ranking (treino conta uma vez, km sem repetir, resumo mensal incluído).
    const [meu] = calcularResultadosRanking([atleta], lancamentos, "trimestre", periodo.inicio, periodo.fim, historicoMensal, regrasTreino ?? undefined);
    const b = getStoredBranding();
    return {
      nome: atleta.nome,
      foto,
      modalidade,
      mes: periodo.mes,
      ano: periodo.ano,
      treinos: meu?.treinos ?? 0,
      km: meu?.km ?? 0,
      pontos: meu?.pontuacaoTotal ?? 0,
      semanas,
      posicaoTrimestre,
      medalhas,
      cor: modalidade === "corrida" ? b.secondary : b.primary,
    };
  }, [qual, atleta, lancamentos, historicoMensal, regrasTreino, foto, modalidade, semanas, medalhas, posicaoTrimestre]);

  async function gerarArquivo() {
    const no = cartao.current;
    if (!no) throw new Error("sem cartão");
    const { toBlob } = await import("html-to-image");
    await document.fonts.ready;
    const blob = await toBlob(no, {
      width: CARTAO_L,
      height: CARTAO_A,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: "none" },
    });
    if (!blob) throw new Error("falha ao gerar imagem");
    return new File([blob], `meu-mes-${dados.mes.toLowerCase()}-${dados.ano}.png`, { type: "image/png" });
  }

  async function compartilhar() {
    setGerando("compartilhar");
    try {
      const arquivo = await gerarArquivo();
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo] });
      } else {
        baixarArquivo(arquivo);
        show("info", "Imagem baixada. Este navegador não compartilha direto: envie pela galeria.");
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") show("error", "Não foi possível gerar a imagem agora. Tente novamente.");
    } finally {
      setGerando(null);
    }
  }

  function baixarArquivo(arquivo: File) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function baixar() {
    setGerando("baixar");
    try {
      baixarArquivo(await gerarArquivo());
      show("success", "Imagem baixada.");
    } catch {
      show("error", "Não foi possível gerar a imagem agora. Tente novamente.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <Modal open={aberto} onClose={onFechar} mobileSheet title="Compartilhar meu mês" description="Uma imagem no formato do status do WhatsApp e dos stories.">
      <div className="flex flex-col gap-4">
        <SegmentedControl
          value={qual}
          onChange={setQual}
          className="mx-auto"
          options={[
            { value: "este", label: intervaloDoMes(0).mes },
            { value: "passado", label: intervaloDoMes(-1).mes },
          ]}
        />
        <Previa>
          <CartaoDoMes ref={cartao} dados={dados} />
        </Previa>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button className="w-full" onClick={() => void compartilhar()} loading={gerando === "compartilhar"} disabled={gerando !== null}>
            <Share2 className="size-4" aria-hidden="true" />
            Compartilhar
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => void baixar()} loading={gerando === "baixar"} disabled={gerando !== null}>
            <Download className="size-4" aria-hidden="true" />
            Baixar imagem
          </Button>
        </div>
      </div>
    </Modal>
  );
}
