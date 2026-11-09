"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { Download, ImagePlus, RotateCcw, Share2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import { reduzirImagem } from "@/lib/fotos";
import { useQrDataUrl } from "@/lib/useQrDataUrl";
import { hojeBrasil } from "@/lib/calendarioPremiacao";
import {
  DIMENSOES_CONVITE,
  FAIXAS,
  LAYOUTS,
  TEXTOS_PADRAO,
  dataCurta,
  nomeDoArquivo,
  textosDoEvento,
  type FaixaConvite,
  type FormatoConvite,
  type LayoutConvite,
  type TextosConvite,
} from "@/lib/convite";
import { ArteConvite } from "@/components/informativo/ArteConvite";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useToast } from "@/components/ui/Toast";
import { PreviaEscalada } from "./PreviaEscalada";
import type { EventoDoc } from "@/lib/types";

const CHAVE_RASCUNHO = "convite:rascunho";

interface Rascunho {
  eventoId: string;
  textos: TextosConvite;
  layout: LayoutConvite;
  formato: FormatoConvite;
  faixa: FaixaConvite;
  comQr: boolean;
}

function lerRascunho(): Rascunho | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_RASCUNHO);
    return bruto ? (JSON.parse(bruto) as Rascunho) : null;
  } catch {
    return null;
  }
}

function gravarRascunho(r: Rascunho) {
  try {
    window.localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
  } catch {
    /* sem armazenamento: o rascunho vale só nesta visita */
  }
}

function AreaDeTexto({ label, value, onChange, linhas = 3, dica }: { label: string; value: string; onChange: (v: string) => void; linhas?: number; dica?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <textarea
        id={id}
        rows={linhas}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-base text-text outline-none focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15 sm:text-sm"
      />
      {dica ? <p className="text-xs text-text-light">{dica}</p> : null}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
      <legend className="float-left mb-1 w-full text-sm font-bold text-text">{titulo}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Convite de evento: começa pelo evento da agenda, o comitê escolhe o layout,
 * ajusta os textos e baixa ou compartilha a imagem. O rascunho fica guardado
 * neste aparelho para continuar depois.
 */
export function ConviteEvento() {
  const { show } = useToast();
  const [eventos, setEventos] = useState<EventoDoc[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [textos, setTextos] = useState<TextosConvite>(TEXTOS_PADRAO);
  const [layout, setLayout] = useState<LayoutConvite>("celebracao");
  const [formato, setFormato] = useState<FormatoConvite>("feed");
  const [faixa, setFaixa] = useState<FaixaConvite>("");
  const [comQr, setComQr] = useState(true);
  const [foto, setFoto] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [exportando, setExportando] = useState<"baixar" | "compartilhar" | null>(null);
  const [cortado, setCortado] = useState(false);
  const arte = useRef<HTMLDivElement>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);

  // Rascunho e agenda.
  useEffect(() => {
    let ativo = true;
    const hoje = hojeBrasil();
    getDocs(query(collection(db, "agenda_eventos"), where("data", ">=", hoje), orderBy("data", "asc")))
      .then((snap) => {
        if (!ativo) return;
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc);
        setEventos(lista);
        const r = lerRascunho();
        if (r) {
          setEventoId(r.eventoId);
          setTextos({ ...TEXTOS_PADRAO, ...r.textos });
          setLayout(r.layout);
          setFormato(r.formato);
          setFaixa(r.faixa);
          setComQr(r.comQr);
        } else if (lista[0]) {
          setEventoId(lista[0].id);
          setTextos(textosDoEvento(lista[0]));
          if (lista[0].tipo !== "reuniao") setLayout("largada");
        }
        setCarregado(true);
      })
      .catch(() => {
        if (!ativo) return;
        const r = lerRascunho();
        if (r) setTextos({ ...TEXTOS_PADRAO, ...r.textos });
        setCarregado(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (carregado) gravarRascunho({ eventoId, textos, layout, formato, faixa, comQr });
  }, [carregado, eventoId, textos, layout, formato, faixa, comQr]);

  const [fontesProntas, setFontesProntas] = useState(false);
  useEffect(() => {
    void Promise.all([
      document.fonts.load("900 italic 40px 'Barlow Condensed'"),
      document.fonts.load("800 40px 'Barlow Condensed'"),
      document.fonts.load("40px 'Kaushan Script'"),
      document.fonts.load("500 20px Barlow"),
    ])
      .catch(() => undefined)
      .then(() => setFontesProntas(true));
  }, []);

  const urlConfirmacao = typeof window === "undefined" ? "" : `${window.location.origin}/eventos`;
  const qr = useQrDataUrl(comQr ? urlConfirmacao : "", 360);
  const { largura, altura } = DIMENSOES_CONVITE[formato];

  // Algum texto passou do espaço da arte?
  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const coluna = arte.current?.querySelector<HTMLElement>("[data-conteudo]");
      setCortado(!!coluna && coluna.scrollHeight > coluna.clientHeight + 2);
    });
    return () => window.cancelAnimationFrame(id);
  }, [textos, layout, formato, faixa, qr, fontesProntas]);

  const mudar = useCallback((campo: keyof TextosConvite, valor: string) => setTextos((t) => ({ ...t, [campo]: valor })), []);

  function escolherEvento(id: string) {
    setEventoId(id);
    const ev = eventos.find((e) => e.id === id);
    setTextos(ev ? textosDoEvento(ev) : TEXTOS_PADRAO);
  }

  function restaurar() {
    const ev = eventos.find((e) => e.id === eventoId);
    setTextos(ev ? textosDoEvento(ev) : TEXTOS_PADRAO);
  }

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      setFoto(await reduzirImagem(arquivo, { lado: 1600, qualidade: 0.86 }));
      setLayout("foto");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível abrir esta imagem.");
    }
  }

  async function gerar() {
    const { toBlob, getFontEmbedCSS } = await import("html-to-image");
    await document.fonts.ready;
    const no = arte.current;
    if (!no) throw new Error("sem arte");
    const fontEmbedCSS = await getFontEmbedCSS(no);
    const blob = await toBlob(no, { width: largura, height: altura, pixelRatio: 1, fontEmbedCSS, cacheBust: true });
    if (!blob) throw new Error("falha ao gerar imagem");
    return new File([blob], nomeDoArquivo(textos.selo || textos.titulo, formato), { type: "image/png" });
  }

  async function baixar() {
    setExportando("baixar");
    try {
      const arquivo = await gerar();
      const url = URL.createObjectURL(arquivo);
      const a = document.createElement("a");
      a.href = url;
      a.download = arquivo.name;
      a.click();
      URL.revokeObjectURL(url);
      show("success", "Convite baixado.");
    } catch {
      show("error", "Não foi possível gerar a imagem agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  async function compartilhar() {
    setExportando("compartilhar");
    try {
      const arquivo = await gerar();
      await navigator.share({ files: [arquivo], title: textos.selo || textos.titulo });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") show("error", "Não foi possível compartilhar agora.");
    } finally {
      setExportando(null);
    }
  }

  const podeCompartilhar =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "teste.png", { type: "image/png" })] });
  const props = { layout, formato, textos, faixa, qr: comQr ? qr : "", foto };
  const miniaturas = useMemo(() => LAYOUTS, []);

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Evento</span>
          <Select value={eventoId} onChange={(e) => escolherEvento(e.target.value)} aria-label="Evento">
            <option value="">Convite avulso (sem evento da agenda)</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {`${dataCurta(e.data)}, ${e.titulo}`}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-light">Data, hora e local vêm da agenda. Dá para mudar tudo abaixo.</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text">Layout</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
            {miniaturas.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayout(l.id)}
                aria-pressed={layout === l.id}
                title={l.descricao}
                className={cn(
                  "group flex flex-col gap-1.5 rounded-[var(--radius)] p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  layout === l.id ? "bg-primary-subtle ring-2 ring-primary" : "hover:bg-bg-inset",
                )}
              >
                <span className="pointer-events-none block overflow-hidden rounded-[6px]" aria-hidden="true">
                  <PreviaEscalada largura={1080} altura={1350}>
                    <ArteConvite {...props} layout={l.id} formato="feed" qr="" />
                  </PreviaEscalada>
                </span>
                <span className={cn("text-xs font-semibold leading-tight", layout === l.id ? "text-primary" : "text-text")}>{l.nome}</span>
              </button>
            ))}
          </div>
        </div>

        {layout === "foto" ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-bg-inset/60 p-3">
            <input ref={entradaFoto} type="file" accept="image/*" className="sr-only" onChange={(e) => void escolherFoto(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" onClick={() => entradaFoto.current?.click()}>
              <ImagePlus className="size-4" aria-hidden="true" />
              {foto ? "Trocar a foto" : "Escolher a foto do fundo"}
            </Button>
            <p className="text-xs text-text-light">Funciona melhor com uma foto do time em pé, com espaço livre embaixo. A foto fica só neste convite, não é enviada ao portal.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Formato</span>
            <SegmentedControl
              value={formato}
              onChange={setFormato}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "feed", label: "Feed" },
                { value: "story", label: "Status" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Selo</span>
            <Select value={faixa} onChange={(e) => setFaixa(e.target.value as FaixaConvite)} aria-label="Selo de destaque">
              <option value="">Sem selo</option>
              {(Object.keys(FAIXAS) as Exclude<FaixaConvite, "">[]).map((f) => (
                <option key={f} value={f}>
                  {FAIXAS[f]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-text-light">{DIMENSOES_CONVITE[formato].uso}</p>

        <div className="flex items-center gap-2">
          <Switch ativo={comQr} onChange={setComQr} rotulo="QR code para confirmar presença" className="-ml-1" />
          <div>
            <p className="text-sm font-medium text-text">QR code para confirmar presença</p>
            <p className="text-xs text-text-light">Abre a agenda do portal, onde o atleta confirma.</p>
          </div>
        </div>

        <Grupo titulo="Títulos">
          <TextField label="Título" value={textos.titulo} onChange={(e) => mudar("titulo", e.target.value)} />
          <TextField label="Nome do evento" value={textos.selo} onChange={(e) => mudar("selo", e.target.value)} />
          <TextField label="Chamada" value={textos.chamada} onChange={(e) => mudar("chamada", e.target.value)} />
        </Grupo>

        <Grupo titulo="Quando e onde">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Data" value={textos.data} placeholder="23/09" onChange={(e) => mudar("data", e.target.value)} />
            <TextField label="Hora" value={textos.hora} placeholder="18h" onChange={(e) => mudar("hora", e.target.value)} />
          </div>
          <TextField label="Dia da semana" value={textos.diaSemana} onChange={(e) => mudar("diaSemana", e.target.value)} />
          <TextField label="Local" value={textos.local} onChange={(e) => mudar("local", e.target.value)} />
        </Grupo>

        <Grupo titulo="Mensagem">
          <AreaDeTexto label="Texto principal" value={textos.texto} onChange={(v) => mudar("texto", v)} dica="Palavras entre *asteriscos* ficam em destaque." />
          <AreaDeTexto label="Texto complementar" value={textos.texto2} onChange={(v) => mudar("texto2", v)} />
          <TextField label="Assinatura (letra cursiva)" value={textos.assinatura} onChange={(e) => mudar("assinatura", e.target.value)} />
          {layout === "celebracao" ? <TextField label="Rodapé" value={textos.rodape} onChange={(e) => mudar("rodape", e.target.value)} /> : null}
          <button type="button" onClick={restaurar} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline">
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {eventoId ? "Voltar aos textos do evento" : "Voltar aos textos padrão"}
          </button>
        </Grupo>
      </Card>

      <div className="order-first flex min-w-0 flex-col gap-3 lg:order-none lg:sticky lg:top-[84px]">
        <div className={cn("mx-auto w-full", formato === "story" ? "max-w-[400px]" : "max-w-[520px]")}>
          <PreviaEscalada largura={largura} altura={altura}>
            <ArteConvite ref={arte} {...props} />
          </PreviaEscalada>
        </div>
        {cortado ? (
          <InlineAlert tone="warning">Parte do texto não coube na arte. Encurte o texto ou use o formato Status, que tem mais espaço.</InlineAlert>
        ) : null}
        {layout === "foto" && !foto ? <InlineAlert tone="info">Escolha uma foto para o fundo. Sem foto, o convite sai com o fundo azul.</InlineAlert> : null}
        <div className={cn("mx-auto flex w-full flex-col gap-2 sm:flex-row", formato === "story" ? "max-w-[400px]" : "max-w-[520px]")}>
          {podeCompartilhar ? (
            <Button className="flex-1" onClick={() => void compartilhar()} loading={exportando === "compartilhar"} disabled={!!exportando}>
              <Share2 className="size-4" aria-hidden="true" />
              Compartilhar
            </Button>
          ) : null}
          <Button className="flex-1" variant={podeCompartilhar ? "secondary" : "primary"} onClick={() => void baixar()} loading={exportando === "baixar"} disabled={!!exportando}>
            <Download className="size-4" aria-hidden="true" />
            Baixar imagem
          </Button>
        </div>
      </div>
    </div>
  );
}
