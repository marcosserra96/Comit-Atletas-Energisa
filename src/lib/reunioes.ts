import type { CheckinReuniao, EventoDoc } from "@/lib/types";

export type { CheckinReuniao };

/**
 * Presença em reunião: o lançamento tem id fixo por reunião e atleta, para a
 * marcação manual e a confirmação pelo app (QR code) nunca contarem duas vezes.
 */
export function idPresencaReuniao(reuniaoId: string, atletaId: string) {
  return `reuniao_${reuniaoId}_${atletaId}`;
}

/** Todas as presenças da mesma reunião formam uma atividade só por atleta. */
export function loteDaReuniao(reuniaoId: string) {
  return `reuniao_${reuniaoId}`;
}

/** Documento `reunioes_checkin/{eventoId}`: só o comitê e o servidor leem. */
export interface SegredoCheckinDoc {
  segredo: string;
  codigoFixo: string;
  atualizadoEm?: unknown;
}

export const JANELA_CODIGO_MS = 30_000;
const ANTES_MIN = 15;
const DEPOIS_MIN = 30;
/** Brasil sem horário de verão desde 2019: o horário da agenda é sempre -03:00. */
const FUSO = "-03:00";

function dataHora(data: string, hora: string) {
  return new Date(`${data}T${hora}:00${FUSO}`);
}

/** Quando a confirmação abre e fecha. */
export function janelaDoCheckin(evento: Pick<EventoDoc, "data" | "horaInicio" | "horaFim"> & { checkin?: CheckinReuniao }) {
  const inicio = dataHora(evento.data, evento.horaInicio || "00:00");
  const fim = dataHora(evento.data, evento.horaFim || evento.horaInicio || "23:59");
  return {
    abre: evento.checkin?.abreEm ? new Date(evento.checkin.abreEm) : new Date(inicio.getTime() - ANTES_MIN * 60_000),
    fecha: evento.checkin?.fechaEm ? new Date(evento.checkin.fechaEm) : new Date(fim.getTime() + DEPOIS_MIN * 60_000),
  };
}

export type SituacaoCheckin = "desligado" | "antes" | "aberto" | "encerrado";

export function situacaoCheckin(
  evento: Pick<EventoDoc, "data" | "horaInicio" | "horaFim"> & { checkin?: CheckinReuniao },
  agora = new Date(),
): SituacaoCheckin {
  if (!evento.checkin?.ativo) return "desligado";
  const { abre, fecha } = janelaDoCheckin(evento);
  if (agora < abre) return "antes";
  if (agora >= fecha) return "encerrado";
  return "aberto";
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I

function aleatorio(tamanho: number, alfabeto: string) {
  const bytes = new Uint8Array(tamanho);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

export function gerarCodigoFixo() {
  return aleatorio(6, ALFABETO);
}

export function gerarSegredo() {
  return aleatorio(32, ALFABETO + "abcdefghijkmnpqrstuvwxyz");
}

/** Maiúsculas, sem espaços nem traços (o atleta pode digitar "ab3 k9z"). */
export function normalizarCodigo(codigo: string) {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function janelaDoCodigo(agora = Date.now()) {
  return Math.floor(agora / JANELA_CODIGO_MS);
}

/** Código de 6 dígitos da janela de 30 s: HMAC-SHA256(segredo, janela). */
export async function codigoDinamico(segredo: string, janela: number) {
  const chave = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(
    await globalThis.crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(String(janela))),
  );
  const numero = ((assinatura[0] << 24) | (assinatura[1] << 16) | (assinatura[2] << 8) | assinatura[3]) >>> 0;
  return String(numero % 1_000_000).padStart(6, "0");
}

/**
 * Confere o código digitado ou lido no QR. No modo dinâmico aceita a janela
 * atual e a anterior (relógios diferentes e quem escaneou no fim dos 30 s).
 */
export async function codigoValido(params: {
  codigo: string;
  dinamico: boolean;
  segredo: SegredoCheckinDoc;
  agora?: number;
}) {
  const codigo = normalizarCodigo(params.codigo);
  if (!codigo) return false;
  if (!params.dinamico) return codigo === params.segredo.codigoFixo;
  const janela = janelaDoCodigo(params.agora);
  for (const j of [janela, janela - 1]) {
    if (codigo === (await codigoDinamico(params.segredo.segredo, j))) return true;
  }
  return false;
}

/** Endereço que o QR code abre: confirma a presença direto no app. */
export function urlDoCheckin(origem: string, eventoId: string, codigo: string) {
  return `${origem}/presenca/${eventoId}?c=${encodeURIComponent(codigo)}`;
}
