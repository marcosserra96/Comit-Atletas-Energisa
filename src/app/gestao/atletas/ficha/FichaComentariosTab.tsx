"use client";

import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { MessageSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/format";
import type { AtletaDoc, ComentarioAtletaDoc } from "@/lib/types";

export function FichaComentariosTab({ atleta }: { atleta: AtletaDoc }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [comentarios, setComentarios] = useState<ComentarioAtletaDoc[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "comentarios_atletas"),
        where("atletaId", "==", atleta.id),
        orderBy("criadoEm", "desc"),
      ),
      (snap) => setComentarios(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ComentarioAtletaDoc)),
      () => setComentarios([]),
    );
    return unsubscribe;
  }, [atleta.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, "comentarios_atletas"), {
        atletaId: atleta.id,
        texto: texto.trim(),
        autorNome: autor.nome,
        autorUid: uid,
        criadoEm: serverTimestamp(),
      });
      setTexto("");
    } catch {
      show("error", "Não foi possível salvar o comentário agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comentarios === null ? (
        <div className="h-24 animate-pulse rounded-[var(--radius)] bg-bg" />
      ) : comentarios.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum comentário ainda"
          description="Registre acompanhamentos, avisos, lesões ou atestados."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {comentarios.map((c) => (
            <div key={c.id} className="rounded-[var(--radius)] border border-border bg-bg p-3">
              <p className="text-sm text-text">{c.texto}</p>
              <p className="mt-1.5 text-xs text-text-muted">
                {c.autorNome} · {formatRelativeTime(c.criadoEm)}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 border-t border-border pt-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Registre uma observação…"
          className="w-full rounded-[var(--radius)] border border-border bg-bg-card p-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <Button type="submit" size="sm" loading={enviando} className="w-fit">
          Adicionar comentário
        </Button>
      </form>
    </div>
  );
}
