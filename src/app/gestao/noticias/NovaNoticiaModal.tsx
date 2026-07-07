"use client";

import { FormEvent, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export function NovaNoticiaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [fixado, setFixado] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const nova = doc(collection(db, "noticias"));
      await setDoc(nova, {
        id: nova.id,
        titulo,
        resumo,
        corpo: resumo,
        fixado,
        autorNome: atleta.nome,
        autorUid: uid,
        criadoEm: serverTimestamp(),
      });
      show("success", "Notícia publicada.");
      setTitulo("");
      setResumo("");
      setFixado(false);
      onClose();
    } catch {
      show("error", "Não foi possível publicar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Publicar notícia">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Título"
          placeholder="Título da notícia"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Conteúdo</label>
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            required
            rows={4}
            placeholder="Escreva o comunicado…"
            className="w-full rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted outline-none focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <label className="flex items-center gap-2.5 text-sm font-medium text-text">
          <input
            type="checkbox"
            checked={fixado}
            onChange={(e) => setFixado(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          Fixar no topo
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Publicar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
