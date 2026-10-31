"use client";

import { useEffect, useId, useState } from "react";
import { CheckCircle2, HeartHandshake } from "lucide-react";
import { apiAutenticada } from "@/lib/apiCliente";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { LIMITE_CORPO, LIMITE_TITULO } from "@/lib/push/regras";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

const TITULO_PADRAO = "Sentimos sua falta!";
const CORPO_PADRAO = "Faz um tempo que você não aparece nos treinos. Que tal voltar esta semana? Veja a agenda de treinos e provas no portal.";

/**
 * Lista de atletas parados: um lembrete para todos de uma vez, com mensagem
 * pronta (dá para editar). Sai como notificação para quem ativou no celular.
 */
export function LembreteParados({ atletaIds }: { atletaIds: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(TITULO_PADRAO);
  const [corpo, setCorpo] = useState(CORPO_PADRAO);
  const [alcance, setAlcance] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const idCorpo = useId();
  const chave = atletaIds.join(",");

  // Quantos deles recebem (têm notificação ativa em algum aparelho).
  useEffect(() => {
    if (!aberto || !chave) return;
    let ativo = true;
    apiAutenticada<{ atletas: number }>("/api/push/enviar", {
      method: "POST",
      body: JSON.stringify({ tipo: "manual", publico: "selecionados", atletaIds: chave.split(","), simular: true }),
    })
      .then((r) => ativo && setAlcance(r.atletas))
      .catch(() => ativo && setAlcance(null));
    return () => {
      ativo = false;
    };
  }, [aberto, chave]);

  async function enviar() {
    setErro("");
    if (!titulo.trim() || !corpo.trim()) {
      setErro("Escreva o título e a mensagem.");
      return;
    }
    setEnviando(true);
    try {
      const r = await apiAutenticada<{ atletas: number }>("/api/push/enviar", {
        method: "POST",
        body: JSON.stringify({ tipo: "manual", publico: "selecionados", atletaIds, titulo: titulo.trim(), corpo: corpo.trim(), link: "/eventos" }),
      });
      setResultado(r.atletas);
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado !== null) {
    return (
      <p className="mb-3 flex items-center gap-2 rounded-[var(--radius)] bg-success/10 px-3 py-2.5 text-sm text-text" role="status">
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
        {resultado > 0 ? `Lembrete enviado para ${plural(resultado, "atleta")}.` : "Nenhum deles tem as notificações ativas no celular."}
      </p>
    );
  }

  if (!aberto) {
    return (
      <Button variant="secondary" className="mb-3 w-full" onClick={() => setAberto(true)}>
        <HeartHandshake className="size-4" aria-hidden="true" />
        Mandar um lembrete para {atletaIds.length === 1 ? "este atleta" : `os ${atletaIds.length}`}
      </Button>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-bg-inset/50 p-3.5">
      <TextField label="Título" value={titulo} maxLength={LIMITE_TITULO} onChange={(e) => setTitulo(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idCorpo} className="text-sm font-medium text-text">
          Mensagem
        </label>
        <textarea
          id={idCorpo}
          rows={3}
          value={corpo}
          maxLength={LIMITE_CORPO}
          onChange={(e) => setCorpo(e.target.value)}
          className={cn(
            "w-full rounded-[var(--radius)] border border-border bg-bg px-3.5 py-2.5 text-base text-text outline-none focus:border-primary focus:bg-bg-card focus:ring-2 focus:ring-primary/15 sm:text-sm",
          )}
        />
      </div>
      <p className="text-xs text-text-light">
        Chega como notificação e abre a agenda de eventos.{" "}
        {alcance === null ? "" : alcance === 0 ? "Nenhum deles ativou as notificações ainda." : `${alcance} de ${atletaIds.length} recebem no celular.`}
      </p>
      {erro ? <p className="text-sm font-medium text-danger">{erro}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={() => void enviar()} loading={enviando} disabled={alcance === 0}>
          Enviar lembrete
        </Button>
      </div>
    </div>
  );
}
