"use client";

import { FormEvent, useId, useState } from "react";
import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { formatShortDate } from "@/lib/format";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { NoticiaDoc } from "@/lib/types";

const campoTexto =
  "w-full rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15";

/**
 * Cria (sem `noticia`) ou edita uma notícia. Montado com `key` pelo pai para
 * reiniciar o formulário a cada abertura.
 */
export function NoticiaModal({
  open,
  noticia,
  onClose,
}: {
  open: boolean;
  noticia?: NoticiaDoc | null;
  onClose: () => void;
}) {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const editando = !!noticia;
  const idResumo = useId();
  const idCorpo = useId();
  const idPrazo = useId();

  const [titulo, setTitulo] = useState(noticia?.titulo ?? "");
  const [resumo, setResumo] = useState(noticia?.resumo ?? "");
  const [corpo, setCorpo] = useState(
    noticia && noticia.corpo && noticia.corpo !== noticia.resumo ? noticia.corpo : "",
  );
  const [fixado, setFixado] = useState(noticia?.fixado ?? false);
  const [visivelAte, setVisivelAte] = useState(noticia?.visivelAte ?? "");
  const [loading, setLoading] = useState(false);

  const hoje = dataIsoLocal();
  const prazoPassado = !!visivelAte && visivelAte < hoje;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const dados = {
      titulo: titulo.trim(),
      resumo: resumo.trim(),
      corpo: corpo.trim(),
      fixado,
      visivelAte: visivelAte || null,
    };
    try {
      if (noticia) {
        await updateDoc(doc(db, "noticias", noticia.id), {
          ...dados,
          atualizadoEm: serverTimestamp(),
        });
        show("success", "Notícia atualizada.");
      } else {
        const nova = doc(collection(db, "noticias"));
        await setDoc(nova, {
          id: nova.id,
          ...dados,
          autorNome: atleta.nome,
          autorUid: uid,
          criadoEm: serverTimestamp(),
        });
        show("success", "Notícia publicada.");
      }
      onClose();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar notícia" : "Publicar notícia"}
      size="md"
      mobileSheet
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Título"
          placeholder="Título da notícia"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          autoFocus={!editando}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={idResumo} className="text-sm font-medium text-text">
            Resumo
          </label>
          <textarea
            id={idResumo}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            required
            rows={3}
            placeholder="O essencial em duas ou três linhas. Aparece na lista de notícias."
            className={campoTexto}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={idCorpo} className="text-sm font-medium text-text">
            Texto completo <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <textarea
            id={idCorpo}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={5}
            placeholder="Detalhes, regras, horários… Aparece quando o atleta abre a notícia."
            className={campoTexto}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={idPrazo} className="text-sm font-medium text-text">
              Mostrar para os atletas até
            </label>
            {visivelAte && (
              <button
                type="button"
                onClick={() => setVisivelAte("")}
                className="text-sm font-semibold text-primary hover:text-primary-hover"
              >
                Sem prazo
              </button>
            )}
          </div>
          <input
            id={idPrazo}
            type="date"
            value={visivelAte}
            min={editando ? undefined : hoje}
            onChange={(e) => setVisivelAte(e.target.value)}
            aria-describedby={`${idPrazo}-ajuda`}
            className={campoTexto}
          />
          <p id={`${idPrazo}-ajuda`} className={prazoPassado ? "text-xs text-warning" : "text-xs text-text-muted"}>
            {!visivelAte
              ? "Sem data, a notícia fica no ar até ser removida."
              : prazoPassado
                ? "Com essa data, a notícia já não aparece para os atletas."
                : `Some para os atletas depois de ${formatShortDate(visivelAte)}. Você continua vendo aqui.`}
          </p>
        </div>

        <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-text">
          <input
            type="checkbox"
            checked={fixado}
            onChange={(e) => setFixado(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          Fixar no topo
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {editando ? "Salvar alterações" : "Publicar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
