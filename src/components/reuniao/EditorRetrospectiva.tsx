"use client";

import { useMemo, useRef, useState } from "react";
import { EyeOff, FolderOpen, Images, Music, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { GRADE_EDITOR } from "@/components/reuniao/estiloEditor";
import { duracaoLegivel, montarCenas, ordenarItens, tituloDoCapitulo, type ItemRetro } from "@/lib/retrospectiva";
import { carregarPasta, definirMusica, limparFotos, marcarItem, tirarMusica, useRetrospectiva } from "@/lib/retrospectivaFotos";
import { opcoesDaRetrospectiva, type SlideLivre } from "@/lib/reuniaoResultados";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";

const ACEITA = "image/*,video/mp4,video/webm,video/quicktime,audio/*,.heic,.heif,.mov";

function Opcao({ titulo, dica, ativo, onChange, disabled }: { titulo: string; dica: string; ativo: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3", disabled && "opacity-50")}>
      <Switch ativo={ativo} onChange={onChange} rotulo={titulo} disabled={disabled} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{titulo}</p>
        <p className="text-xs text-text-light [text-wrap:pretty]">{dica}</p>
      </div>
    </div>
  );
}

/** Grade para revisar: tocar na foto tira ou põe de volta; a estrela deixa mais tempo na tela. */
function RevisarFotos({ livreId, itens, aberto, onFechar }: { livreId: string; itens: ItemRetro[]; aberto: boolean; onFechar: () => void }) {
  const grupos = useMemo(() => {
    const m = new Map<string, ItemRetro[]>();
    for (const i of ordenarItens(itens)) m.set(i.capitulo, [...(m.get(i.capitulo) ?? []), i]);
    return [...m.entries()];
  }, [itens]);
  const ocultas = itens.filter((i) => i.oculta).length;
  const favoritas = itens.filter((i) => i.favorita).length;
  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Revisar as fotos"
      description="Toque na foto para tirar da retrospectiva (ou pôr de volta). A estrela deixa a foto mais tempo na tela."
      size="xl"
      mobileSheet
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">
            {itens.length - ocultas} de {itens.length} entram{favoritas ? ` · ${favoritas} com estrela` : ""}
          </span>
          <Button onClick={onFechar}>Pronto</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {grupos.map(([capitulo, lista]) => (
          <section key={capitulo || "_"} className="flex flex-col gap-2">
            {grupos.length > 1 ? <h3 className="text-sm font-bold text-text">{capitulo ? tituloDoCapitulo(capitulo) : "Fotos soltas na pasta"}</h3> : null}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {lista.map((i) => (
                <li key={i.id} className="relative">
                  <button
                    type="button"
                    onClick={() => marcarItem(livreId, i.id, "oculta")}
                    aria-pressed={!i.oculta}
                    aria-label={`${i.oculta ? "Pôr de volta" : "Tirar"} ${i.nome}`}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-[var(--radius-sm)] bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      i.oculta && "opacity-35 grayscale",
                    )}
                  >
                    {i.tipo === "video" ? (
                      <video src={i.url} muted preload="metadata" className="size-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.url} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                    {i.tipo === "video" ? <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">vídeo</span> : null}
                    {i.oculta ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <EyeOff className="size-6 text-text" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                  {!i.oculta ? (
                    <button
                      type="button"
                      onClick={() => marcarItem(livreId, i.id, "favorita")}
                      aria-pressed={!!i.favorita}
                      aria-label={`${i.favorita ? "Tirar a estrela de" : "Dar estrela para"} ${i.nome}`}
                      className={cn(
                        "absolute right-1 top-1 flex size-8 items-center justify-center rounded-full backdrop-blur-sm",
                        i.favorita ? "bg-[var(--color-ranking-gold)] text-white" : "bg-black/35 text-white hover:bg-black/55",
                      )}
                    >
                      <Star className={cn("size-4", i.favorita && "fill-current")} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}

/** Retrospectiva: textos, tempo, música e opções; para ensaiar, a pasta (fica só nesta aba). */
export function EditorRetrospectiva({ livre, onChange }: { livre: SlideLivre; onChange: (l: SlideLivre) => void }) {
  const { itens, musica, preparando, ignorados } = useRetrospectiva(livre.id);
  const pasta = useRef<HTMLInputElement>(null);
  const entradaMusica = useRef<HTMLInputElement>(null);
  const [revisar, setRevisar] = useState(false);
  const { show } = useToast();
  const opcoes = opcoesDaRetrospectiva(livre);
  const mudar = (campos: Partial<typeof opcoes>) => {
    const novo = { ...opcoes, ...campos };
    onChange({ ...livre, segundos: novo.segundos, retro: { repetir: novo.repetir, embaralhar: novo.embaralhar, legendas: novo.legendas, ajustarMusica: novo.ajustarMusica } });
  };
  const { cenas, total } = useMemo(() => montarCenas(itens, opcoes, musica?.duracao), [itens, opcoes, musica?.duracao]);
  const entram = itens.filter((i) => !i.oculta);
  const videos = entram.filter((i) => i.tipo === "video").length;
  const capitulos = cenas.filter((c) => c.tipo === "capitulo").length;
  const resumo = [
    `${entram.length - videos} ${entram.length - videos === 1 ? "foto" : "fotos"}`,
    videos ? `${videos} ${videos === 1 ? "vídeo" : "vídeos"}` : "",
    capitulos ? `${capitulos} capítulos` : "",
    `cerca de ${duracaoLegivel(total)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  async function receber(lista: FileList | null) {
    if (!lista?.length) return;
    const r = await carregarPasta(livre.id, lista);
    if (!r) return;
    const partes = [r.aceitas ? `${r.aceitas} fotos e vídeos prontos` : "Nenhuma foto ou vídeo que o navegador abra nessa pasta", r.musica ? "a música da pasta vai tocar junto" : "", r.ignoradas ? `${r.ignoradas} arquivos ignorados` : ""];
    show(r.aceitas ? "success" : "info", `${partes.filter(Boolean).join("; ")}.`);
  }

  return (
    <div className={GRADE_EDITOR}>
      <TextField label="Título" value={livre.titulo} maxLength={60} placeholder="Ex.: Retrospectiva 2026" onChange={(e) => onChange({ ...livre, titulo: e.target.value })} />
      <TextField label="Subtítulo" value={livre.texto} maxLength={80} placeholder="Ex.: Os momentos do nosso time" onChange={(e) => onChange({ ...livre, texto: e.target.value })} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Tempo de cada foto</span>
        <SegmentedControl
          value={String(opcoes.segundos)}
          onChange={(v) => mudar({ segundos: Number(v) })}
          className="w-full [&>button]:flex-1"
          options={["3", "4", "5", "7", "10"].map((v) => ({ value: v, label: `${v} s` }))}
        />
        {opcoes.ajustarMusica && musica ? <p className="text-xs text-text-light">Com a música, o tempo das fotos se ajusta para acabar junto com ela.</p> : null}
      </div>

      <div className="flex flex-col gap-3">
        <Opcao titulo="Legenda com o mês" dica="“Março 2026” aparece quando o mês das fotos muda." ativo={opcoes.legendas} onChange={(v) => mudar({ legendas: v })} />
        <Opcao titulo="Embaralhar a ordem" dica="Mistura as fotos dentro de cada capítulo (sem legenda do mês)." ativo={opcoes.embaralhar} onChange={(v) => mudar({ embaralhar: v })} />
        <Opcao
          titulo="Repetir sem parar"
          dica="Bom para deixar passando no intervalo. Desligado, termina num cartão de encerramento."
          ativo={opcoes.repetir}
          onChange={(v) => mudar({ repetir: v })}
        />
        <Opcao
          titulo="Ajustar o tempo à música"
          dica={musica ? `As fotos se ajustam para a retrospectiva durar o mesmo que a música (${duracaoLegivel(musica.duracao)}).` : "Escolha uma música para usar."}
          ativo={opcoes.ajustarMusica}
          onChange={(v) => mudar({ ajustarMusica: v })}
          disabled={!musica}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--radius)] bg-bg-inset/60 p-3">
        <p className="text-sm text-text [text-wrap:pretty]">
          Fotos, vídeos e música <b>não são enviados ao portal</b>: na hora de apresentar, o slide pede a pasta. Escolha agora para ensaiar (vale até fechar esta página). Subpastas viram capítulos; numere (01, 02…) para mandar na ordem.
        </p>
        <input ref={pasta} type="file" multiple accept={ACEITA} className="sr-only" aria-label="Escolher a pasta" onChange={(e) => void receber(e.target.files).finally(() => (e.target.value = ""))} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
        <input
          ref={entradaMusica}
          type="file"
          accept="audio/*"
          className="sr-only"
          aria-label="Escolher a música"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void definirMusica(livre.id, f).then((ok) => !ok && show("error", "O navegador não conseguiu abrir essa música. Use MP3 ou M4A."));
            e.target.value = "";
          }}
        />
        {preparando ? (
          <div className="flex flex-col gap-1.5" role="status">
            <span className="text-sm font-medium text-text">
              Preparando… {preparando.feitos} de {preparando.total}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(preparando.feitos / Math.max(1, preparando.total)) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => pasta.current?.click()}>
              <FolderOpen className="size-4" aria-hidden="true" />
              {itens.length ? "Trocar a pasta" : "Escolher a pasta agora"}
            </Button>
            {itens.length ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setRevisar(true)}>
                <Images className="size-4" aria-hidden="true" />
                Revisar fotos
              </Button>
            ) : null}
          </div>
        )}
        {itens.length && !preparando ? (
          <p className="text-sm text-text-secondary">
            {resumo}
            {ignorados ? <span className="text-text-light"> · {ignorados} arquivos ignorados</span> : null}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Music className="size-4 shrink-0 text-text-light" aria-hidden="true" />
          {musica ? (
            <>
              <span className="min-w-0 flex-1 truncate text-sm text-text">
                {musica.nome} <span className="text-text-light">· {duracaoLegivel(musica.duracao)}</span>
              </span>
              <button type="button" onClick={() => entradaMusica.current?.click()} className="min-h-9 text-xs font-semibold text-primary hover:underline">
                Trocar
              </button>
              <button type="button" onClick={() => tirarMusica(livre.id)} className="min-h-9 text-xs font-semibold text-text-light hover:text-danger">
                Tirar
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-sm text-text-light">Sem música (uma música dentro da pasta entra sozinha)</span>
              <button type="button" onClick={() => entradaMusica.current?.click()} className="min-h-9 text-xs font-semibold text-primary hover:underline">
                Escolher música
              </button>
            </>
          )}
        </div>
        {itens.length || musica ? (
          <button type="button" onClick={() => limparFotos(livre.id)} className="self-start text-xs font-semibold text-text-light hover:text-danger">
            Tirar tudo
          </button>
        ) : null}
      </div>
      <p className="text-xs text-text-light">Ao vivo: espaço pausa e as setas trocam a foto. Para ir ao próximo slide, use o passador (Page Down) ou Enter.</p>
      <RevisarFotos livreId={livre.id} itens={itens} aberto={revisar} onFechar={() => setRevisar(false)} />
    </div>
  );
}
