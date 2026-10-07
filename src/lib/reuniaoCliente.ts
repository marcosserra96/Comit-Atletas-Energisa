"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { codigoDinamico, gerarCodigoFixo, gerarSegredo, janelaDoCodigo, urlDoCheckin, type SegredoCheckinDoc } from "@/lib/reunioes";
import { useQrDataUrl } from "@/lib/useQrDataUrl";
import type { ReuniaoResultadosDoc } from "@/lib/reuniaoResultados";
import type { EventoDoc } from "@/lib/types";

async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const resposta = await fetch(caminho, {
    ...init,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as T & { error?: string };
  if (!resposta.ok) throw new Error(corpo.error || "Não foi possível concluir agora.");
  return corpo;
}

export const listarReunioes = () =>
  api<{ reunioes: ReuniaoResultadosDoc[] }>("/api/reunioes-resultados").then((r) => r.reunioes);

export const salvarReuniao = (reuniao: Omit<ReuniaoResultadosDoc, "id"> & { id?: string }) =>
  api<{ id: string }>("/api/reunioes-resultados", { method: "POST", body: JSON.stringify(reuniao) }).then((r) => r.id);

export const apagarReuniao = (id: string) =>
  api("/api/reunioes-resultados", { method: "DELETE", body: JSON.stringify({ id }) });

export const enviarImagemSlide = (dataUrl: string) =>
  api<{ id: string }>("/api/reunioes-resultados/imagens", { method: "POST", body: JSON.stringify({ dataUrl }) }).then((r) => r.id);

const cacheImagens = new Map<string, string>();

/** Imagens dos slides livres (id → data URL), com cache da sessão. */
export function useImagensReuniao(ids: readonly string[]) {
  const [, forcar] = useState(0);
  const chave = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    const faltam = chave.split(",").filter((id) => id && !cacheImagens.has(id));
    if (faltam.length === 0) return;
    let ativo = true;
    api<{ imagens: Record<string, string> }>(`/api/reunioes-resultados/imagens?ids=${faltam.join(",")}`)
      .then(({ imagens }) => {
        for (const [id, url] of Object.entries(imagens)) cacheImagens.set(id, url);
        if (ativo) forcar((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [chave]);
  const out: Record<string, string> = {};
  for (const id of ids) {
    const url = cacheImagens.get(id);
    if (url) out[id] = url;
  }
  return out;
}

export function guardarImagemNoCache(id: string, dataUrl: string) {
  cacheImagens.set(id, dataUrl);
}

/**
 * QR de presença da reunião, igual ao da tela "Presença e QR code": código fixo
 * ou o dinâmico de 30 s. Sem a permissão de Eventos, o segredo não pode ser
 * lido e `semPermissao` volta verdadeiro.
 */
export function useQrPresenca(evento: EventoDoc | null) {
  const [segredo, setSegredo] = useState<{ id: string; dados: SegredoCheckinDoc | null; negado: boolean } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [dinamico, setDinamico] = useState<{ janela: number; codigo: string } | null>(null);
  const eventoId = evento?.id ?? null;
  const usaDinamico = evento?.checkin?.dinamico === true;

  useEffect(() => {
    if (!eventoId) return;
    let ativo = true;
    const ref = doc(db, "reunioes_checkin", eventoId);
    getDoc(ref)
      .then(async (s) => {
        if (s.exists()) return s.data() as SegredoCheckinDoc;
        // Reunião sem código ainda (nunca abriram a tela de presença): cria, igual àquela tela.
        const novo = { segredo: gerarSegredo(), codigoFixo: gerarCodigoFixo() };
        await setDoc(ref, { ...novo, atualizadoEm: serverTimestamp() });
        return novo;
      })
      .then((dados) => ativo && setSegredo({ id: eventoId, dados, negado: false }))
      .catch(() => ativo && setSegredo({ id: eventoId, dados: null, negado: true }));
    return () => {
      ativo = false;
    };
  }, [eventoId]);

  useEffect(() => {
    if (!usaDinamico) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [usaDinamico]);

  const atual = segredo?.id === eventoId ? segredo : null;
  const janela = janelaDoCodigo(agora);
  useEffect(() => {
    if (!usaDinamico || !atual?.dados) return;
    let ativo = true;
    codigoDinamico(atual.dados.segredo, janela).then((codigo) => ativo && setDinamico({ janela, codigo }));
    return () => {
      ativo = false;
    };
  }, [usaDinamico, atual?.dados, janela]);

  const codigo = !atual?.dados ? "" : usaDinamico ? (dinamico?.janela === janela ? dinamico.codigo : "") : atual.dados.codigoFixo;
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const qr = useQrDataUrl(codigo && eventoId ? urlDoCheckin(origem, eventoId, codigo) : "", 900);
  return { qr: qr || null, semPermissao: !!atual?.negado };
}
