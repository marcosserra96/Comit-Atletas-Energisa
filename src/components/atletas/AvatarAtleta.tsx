"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { iniciais, FOTO_LADO } from "@/lib/fotoRegras";
import { reduzirImagem, salvarFotoAtleta, useFotoAtleta, useFotosAtletas, type PessoaComFoto } from "@/lib/fotos";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** Tons fixos por nome: a mesma pessoa tem sempre a mesma cor. */
const TONS = [
  "bg-primary-subtle text-primary",
  "bg-secondary-subtle text-secondary",
  "bg-accent-subtle text-accent",
  "bg-ranking-gold-bg text-ranking-gold-text",
  "bg-sport-running-subtle text-sport-running",
  "bg-sport-cycling-subtle text-sport-cycling",
];

export function tomDoNome(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONS[h % TONS.length];
}

/** Foto redonda do atleta ou, sem foto, as iniciais. */
export function AvatarAtleta({
  nome,
  foto,
  className,
  tom,
}: {
  nome: string;
  foto?: string | null;
  /** Tamanho e tipografia (ex.: "size-10 text-sm"). */
  className?: string;
  /** Cores das iniciais quando não há foto. Padrão: um tom fixo por nome. */
  tom?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        !foto && (tom ?? tomDoNome(nome)),
        className ?? "size-10 text-sm",
      )}
      aria-hidden="true"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="size-full object-cover" />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}

/**
 * Avatar que busca a própria foto (pelo cache compartilhado, em lote com o
 * resto da tela). Para listas: troque a bolinha da inicial por este.
 */
export function AvatarPessoa({
  pessoa,
  nome,
  className,
  tom,
}: {
  pessoa: PessoaComFoto;
  nome: string;
  className?: string;
  tom?: string;
}) {
  const foto = useFotoAtleta(pessoa);
  return <AvatarAtleta nome={nome} foto={foto} className={className} tom={tom} />;
}

/** Trocar ou tirar a foto (ficha do comitê e Perfil do atleta). */
export function EditorFotoAtleta({
  atleta,
  podeEditar = true,
}: {
  atleta: { id: string; nome: string; fotoVersao?: number | null };
  podeEditar?: boolean;
}) {
  const { show } = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [salvando, setSalvando] = useState(false);
  const fotos = useFotosAtletas([atleta]);
  const foto = fotos[atleta.id];

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setSalvando(true);
    try {
      const dataUrl = await reduzirImagem(arquivo, { lado: FOTO_LADO, quadrada: true });
      await salvarFotoAtleta(atleta.id, dataUrl);
      show("success", "Foto atualizada.");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível salvar a foto.");
    } finally {
      setSalvando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setSalvando(true);
    try {
      await salvarFotoAtleta(atleta.id, null);
      show("success", "Foto removida.");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível remover a foto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <AvatarAtleta nome={atleta.nome} foto={foto} className="size-20 text-2xl" />
      {podeEditar ? (
        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void escolher(e.target.files?.[0])}
            aria-label="Escolher foto"
          />
          <Button type="button" size="sm" variant="secondary" loading={salvando} onClick={() => entrada.current?.click()}>
            <Camera className="size-4" aria-hidden="true" />
            {foto ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {foto ? (
            <button
              type="button"
              onClick={() => void remover()}
              disabled={salvando}
              className="inline-flex min-h-9 items-center gap-1.5 px-1 text-xs font-semibold text-text-light hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remover foto
            </button>
          ) : (
            <p className="text-xs text-text-muted">Rosto bem visível. Aparece no portal e no pódio da reunião.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Avatar grande do Perfil: tocar abre o editor de foto (o próprio atleta). */
export function FotoDoPerfil({
  atleta,
  somenteLeitura = false,
}: {
  atleta: { id: string; nome: string; fotoVersao?: number | null };
  somenteLeitura?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const fotos = useFotosAtletas([atleta]);
  const avatar = <AvatarAtleta nome={atleta.nome} foto={fotos[atleta.id]} className="size-16 text-2xl shadow-sm sm:size-24 sm:text-4xl" />;
  if (somenteLeitura) return avatar;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={fotos[atleta.id] ? "Trocar sua foto" : "Adicionar sua foto"}
      >
        {avatar}
        <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-bg-card bg-primary text-on-primary shadow-sm sm:size-8">
          <Camera className="size-3.5 sm:size-4" aria-hidden="true" />
        </span>
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title="Sua foto" size="sm" mobileSheet>
        <div className="flex flex-col gap-4">
          <EditorFotoAtleta atleta={atleta} />
          <p className="text-sm text-text-light">
            Use uma foto com o rosto bem visível. Ela aparece no seu perfil, no ranking da sua equipe, para o comitê e no pódio da reunião de resultados.
          </p>
        </div>
      </Modal>
    </>
  );
}
