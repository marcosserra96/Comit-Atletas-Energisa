"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, Bike, CalendarCog, Download, Footprints, Loader2, Share2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ArteInformativo, type MarcaInformativo } from "@/components/informativo/ArteInformativo";
import { temPermissao } from "@/lib/permissoes";
import { getStoredBranding } from "@/lib/branding";
import { useDiasTreino } from "@/lib/useDiasTreino";
import { descreverDias } from "@/lib/aderencia";
import { plural } from "@/lib/format";
import {
  DIMENSOES,
  mesReferenciaPadrao,
  montarInformativo,
  paginar,
  rotuloPeriodo,
  sufixoArquivo,
  type FormatoInformativo,
} from "@/lib/informativo";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Últimos 24 meses, do mais recente para o mais antigo. */
function competenciasRecentes(hoje = new Date()) {
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { valor, rotulo: `${MESES[d.getMonth()]} ${d.getFullYear()}` };
  });
}

/** Mostra a arte em tamanho real reduzida para caber na largura disponível. */
function PreviaEscalada({ largura, altura, children }: { largura: number; altura: number; children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.3);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setEscala(entrada.contentRect.width / largura));
    obs.observe(el);
    return () => obs.disconnect();
  }, [largura]);
  return (
    <div ref={caixa} className="w-full">
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)]"
        style={{ height: altura * escala }}
      >
        <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: largura, height: altura }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function InformativoPage() {
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const diasTreino = useDiasTreino();
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [mensais, setMensais] = useState<HistoricoMensalDoc[]>([]);
  const [erro, setErro] = useState(false);

  const opcoesMes = useMemo(() => competenciasRecentes(), []);
  const [modalidade, setModalidade] = useState<Modalidade>("corrida");
  const [modo, setModo] = useState<"mes" | "intervalo">("mes");
  const [de, setDe] = useState(mesReferenciaPadrao());
  const [ate, setAte] = useState(mesReferenciaPadrao());
  const [formato, setFormato] = useState<FormatoInformativo>("vertical");
  const [exportando, setExportando] = useState<"baixar" | "compartilhar" | null>(null);
  const artes = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      getDocs(collection(db, "atletas")),
      getDocs(collection(db, "historico_pontos")),
      getDocs(collection(db, "historico_mensal")).catch(() => null),
    ])
      .then(([a, l, m]) => {
        if (!ativo) return;
        setAtletas(a.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc));
        setLancamentos(l.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
        setMensais(m ? m.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoMensalDoc) : []);
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const periodo = useMemo(() => {
    if (modo === "mes") return { de, ate: de };
    return de <= ate ? { de, ate } : { de: ate, ate: de };
  }, [modo, de, ate]);

  const marca = useMemo<MarcaInformativo>(() => {
    const b = getStoredBranding();
    return {
      primaria: b.primary,
      secundaria: b.secondary,
      destaque: b.accent,
      logo: "/logos/logo-comite-branca-trim.png",
    };
  }, []);

  const dados = useMemo(() => {
    if (!atletas || !lancamentos || !diasTreino) return null;
    return montarInformativo({ modalidade, periodo, atletas, lancamentos, resumosMensais: mensais, diasTreino });
  }, [atletas, lancamentos, mensais, diasTreino, modalidade, periodo]);

  const paginas = useMemo(() => (dados ? paginar(dados.ranking, formato) : []), [dados, formato]);
  const { largura, altura } = DIMENSOES[formato];
  const semAgenda = diasTreino ? diasTreino[modalidade].dias.length === 0 : false;
  const podeCompartilhar =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([""], "teste.png", { type: "image/png" })] });

  function nomeArquivo(i: number) {
    const sufixoPagina = paginas.length > 1 ? `-${i + 1}de${paginas.length}` : "";
    const f = formato === "paisagem" ? "16x9" : "vertical";
    return `informativo-${modalidade === "corrida" ? "corrida" : "bike"}-${sufixoArquivo(periodo)}-${f}${sufixoPagina}.png`;
  }

  async function gerarArquivos() {
    const { toBlob, getFontEmbedCSS } = await import("html-to-image");
    await document.fonts.ready;
    const nos = artes.current.slice(0, paginas.length).filter((n): n is HTMLDivElement => !!n);
    // As fontes são embutidas uma vez e reaproveitadas em todas as páginas.
    const fontEmbedCSS = await getFontEmbedCSS(nos[0]);
    const arquivos: File[] = [];
    for (const [i, no] of nos.entries()) {
      const blob = await toBlob(no, { width: largura, height: altura, pixelRatio: 1, fontEmbedCSS, cacheBust: true });
      if (!blob) throw new Error("falha ao gerar imagem");
      arquivos.push(new File([blob], nomeArquivo(i), { type: "image/png" }));
    }
    return arquivos;
  }

  async function baixar() {
    setExportando("baixar");
    try {
      const arquivos = await gerarArquivos();
      for (const arquivo of arquivos) {
        const url = URL.createObjectURL(arquivo);
        const a = document.createElement("a");
        a.href = url;
        a.download = arquivo.name;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 250));
      }
      show("success", arquivos.length > 1 ? `${arquivos.length} imagens baixadas.` : "Imagem baixada.");
    } catch {
      show("error", "Não foi possível gerar a imagem agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  async function compartilhar() {
    setExportando("compartilhar");
    try {
      const arquivos = await gerarArquivos();
      await navigator.share({
        files: arquivos,
        title: `Ranking ${modalidade === "corrida" ? "Corrida" : "Bike"} · ${rotuloPeriodo(periodo)}`,
      });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") show("error", "Não foi possível compartilhar agora.");
    } finally {
      setExportando(null);
    }
  }

  if (!temPermissao(usuario, "inicio")) return <NotAuthorized />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/gestao"
          className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text"
        >
          <ArrowLeft className="size-4" />
          Visão estratégica
        </Link>
        <h1 className="text-2xl font-extrabold text-text">Informativo para divulgação</h1>
        <p className="text-sm text-text-light">
          Ranking de pontos com pódio, tabela e aderência. Pronto para postar ou mandar no WhatsApp.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <Card className="flex flex-col gap-5 lg:sticky lg:top-[84px]">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-light">Modalidade</span>
            <SegmentedControl
              value={modalidade}
              onChange={setModalidade}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "corrida", label: "Corrida", icon: Footprints },
                { value: "bicicleta", label: "Bike", icon: Bike },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-light">Período</span>
            <SegmentedControl
              value={modo}
              onChange={setModo}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "mes", label: "Um mês" },
                { value: "intervalo", label: "Intervalo" },
              ]}
            />
            <div className={modo === "intervalo" ? "grid grid-cols-2 gap-2" : ""}>
              <Select value={de} onChange={(e) => setDe(e.target.value)}>
                {opcoesMes.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {modo === "intervalo" ? `De ${m.rotulo}` : m.rotulo}
                  </option>
                ))}
              </Select>
              {modo === "intervalo" ? (
                <Select value={ate} onChange={(e) => setAte(e.target.value)}>
                  {opcoesMes.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      Até {m.rotulo}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-light">Formato</span>
            <SegmentedControl
              value={formato}
              onChange={setFormato}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "vertical", label: "Vertical" },
                { value: "paisagem", label: "16:9" },
              ]}
            />
            <p className="text-xs text-text-muted">
              {formato === "vertical"
                ? "1080 × 1920, ideal para WhatsApp e status."
                : "1920 × 1080, para telas, apresentações e e-mail."}
            </p>
          </div>

          {semAgenda ? (
            <InlineAlert tone="warning">
              {modalidade === "corrida" ? "Corrida" : "Bike"} está sem dias de treino definidos, então a aderência sai
              como “—”.{" "}
              <Link href="/gestao/criterios" className="font-semibold underline">
                Definir dias de treino
              </Link>
            </InlineAlert>
          ) : diasTreino ? (
            <p className="flex items-start gap-2 text-xs text-text-light">
              <CalendarCog className="mt-0.5 size-3.5 shrink-0" />
              Aderência com base nos treinos de {descreverDias(diasTreino[modalidade].dias)}.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm text-text-light">
              {dados
                ? `${plural(dados.totais.atletas, "atleta")} · ${plural(paginas.length, "imagem", "imagens")}`
                : "Carregando dados…"}
            </p>
            {podeCompartilhar ? (
              <Button onClick={compartilhar} loading={exportando === "compartilhar"} disabled={!dados || !!exportando}>
                <Share2 className="size-4" />
                Compartilhar
              </Button>
            ) : null}
            <Button
              variant={podeCompartilhar ? "secondary" : "primary"}
              onClick={baixar}
              loading={exportando === "baixar"}
              disabled={!dados || !!exportando}
            >
              <Download className="size-4" />
              {paginas.length > 1 ? `Baixar ${paginas.length} imagens` : "Baixar imagem"}
            </Button>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {erro ? (
            <InlineAlert tone="danger">Não foi possível carregar os dados. Confira a conexão e recarregue.</InlineAlert>
          ) : !dados ? (
            <div className="flex h-96 items-center justify-center rounded-[var(--radius-lg)] bg-bg-subtle">
              <Loader2 className="size-6 animate-spin text-text-muted" />
            </div>
          ) : (
            paginas.map((pagina, i) => (
              <div
                key={`${formato}-${pagina.numero}`}
                className={formato === "vertical" ? "mx-auto w-full max-w-[460px]" : "w-full"}
              >
                {paginas.length > 1 ? (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Imagem {pagina.numero} de {paginas.length}
                  </p>
                ) : null}
                <PreviaEscalada largura={largura} altura={altura}>
                  <ArteInformativo
                    ref={(no) => {
                      artes.current[i] = no;
                    }}
                    dados={dados}
                    pagina={pagina}
                    formato={formato}
                    marca={marca}
                  />
                </PreviaEscalada>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
