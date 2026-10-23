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
import { cn } from "@/lib/cn";
import { periodosDoResumo, type IdPeriodoResumo, type PeriodoResumo, type TrimestreDoResumo } from "@/lib/resumoPeriodo";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CARTAO_A, CARTAO_L, CartaoDoMes, type DadosCartaoDoMes } from "./CartaoDoMes";

export interface ParamsCartaoDoMes {
  atleta: AtletaDoc;
  modalidade: Modalidade;
  foto?: string;
  lancamentos: HistoricoPontoDoc[];
  historicoMensal: HistoricoMensalDoc[];
  regrasTreino: RegrasDeTreino | null;
  semanas: number;
  medalhas: MedalhaDoAtleta[];
  posicaoTrimestre: number | null;
  /** Trimestres do calendário de premiação (para a opção "Trimestre"). */
  trimestres: readonly TrimestreDoResumo[];
}

/** Os períodos que a imagem oferece hoje: o mês atual e o passado, o trimestre e, em dezembro e janeiro, o ano. */
export function periodosDaImagem(p: Pick<ParamsCartaoDoMes, "trimestres">, hoje = dataIsoLocal()) {
  return periodosDoResumo(hoje, p.trimestres);
}

/** Os números do cartão de um período: o mesmo cálculo do ranking (treino conta uma vez, km sem repetir, resumo mensal incluído). */
export function dadosDoCartaoDoMes(p: ParamsCartaoDoMes, periodo: PeriodoResumo): DadosCartaoDoMes {
  const [meu] = calcularResultadosRanking([p.atleta], p.lancamentos, "trimestre", periodo.inicio, periodo.fim, p.historicoMensal, p.regrasTreino ?? undefined);
  const b = getStoredBranding();
  return {
    nome: p.atleta.nome,
    foto: p.foto,
    modalidade: p.modalidade,
    titulo: periodo.titulo,
    subtitulo: periodo.subtitulo,
    treinos: meu?.treinos ?? 0,
    km: meu?.km ?? 0,
    pontos: meu?.pontuacaoTotal ?? 0,
    semanas: p.semanas,
    posicaoTrimestre: p.posicaoTrimestre,
    medalhas: p.medalhas,
    cor: p.modalidade === "corrida" ? b.secondary : b.primary,
  };
}

/** Escala o cartão 1080 × 1920 para caber na largura da caixa. */
export function Previa({ children, className }: { children: React.ReactNode; className?: string }) {
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
    <div ref={caixa} className={cn("relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)]", className)} style={{ aspectRatio: `${CARTAO_L} / ${CARTAO_A}` }}>
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
  trimestres,
  periodoInicial,
}: ParamsCartaoDoMes & {
  aberto: boolean;
  onFechar: () => void;
  /** Qual período aparece primeiro; sem isso, o mês passado até o dia 5 e o atual depois. */
  periodoInicial?: IdPeriodoResumo;
}) {
  const { show } = useToast();
  const cartao = useRef<HTMLDivElement>(null);
  const [qual, setQual] = useState<IdPeriodoResumo>(() => periodoInicial ?? (Number(dataIsoLocal().slice(8, 10)) <= 5 ? "passado" : "este"));
  const periodos = useMemo(() => periodosDaImagem({ trimestres }), [trimestres]);
  const periodo = periodos.find((x) => x.id === qual) ?? periodos[0];
  const [gerando, setGerando] = useState<"compartilhar" | "baixar" | null>(null);

  const dados = useMemo<DadosCartaoDoMes>(
    () => dadosDoCartaoDoMes({ atleta, modalidade, foto, lancamentos, historicoMensal, regrasTreino, semanas, medalhas, posicaoTrimestre, trimestres }, periodo),
    [periodo, atleta, lancamentos, historicoMensal, regrasTreino, foto, modalidade, semanas, medalhas, posicaoTrimestre, trimestres],
  );

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
    return new File([blob], `meu-resumo-${periodo.arquivo}.png`, { type: "image/png" });
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
    <Modal open={aberto} onClose={onFechar} mobileSheet title="Compartilhar meu resumo" description="Uma imagem no formato do status do WhatsApp e dos stories.">
      <div className="flex flex-col gap-4">
        <SegmentedControl
          value={qual}
          onChange={setQual}
          // Até quatro opções: dividem a largura igualmente, sem passar da tela no celular.
          className={cn("mx-auto", periodos.length > 2 && "w-full *:flex-1 *:px-1.5 sm:*:px-3")}
          options={periodos.map((x) => ({ value: x.id, label: x.rotulo }))}
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
