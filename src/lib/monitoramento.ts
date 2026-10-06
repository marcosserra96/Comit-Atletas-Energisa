/**
 * Configuração do monitor de erros (Sentry), compartilhada por navegador,
 * servidor e edge. Regra de ouro (LGPD): nenhum dado pessoal sai do portal.
 * Só vai o id anônimo do login; e-mail, CPF, telefone, tokens e parâmetros de
 * URL (ex.: oobCode da troca de senha) são apagados antes do envio.
 */
import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";

/** O DSN é público por natureza (vai no JavaScript do navegador). */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://5206e9eafa61299caa61471901c8c54b@o4512209662967808.ingest.de.sentry.io/4512209667162192";

/** Só envia em build de produção fora do emulador: dev não gasta a cota. */
export const monitorLigado =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" &&
  process.env.NEXT_PUBLIC_SENTRY_DESLIGADO !== "true";

/** production | preview | development (Vercel expõe NEXT_PUBLIC_VERCEL_ENV). */
export const ambienteMonitor = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "production";

/** Erros que não são bug do portal: rede do celular caindo, extensões, abortos. */
export const ERROS_IGNORADOS: (string | RegExp)[] = [
  /Failed to fetch/i,
  /Load failed/i,
  /NetworkError/i,
  /network request failed/i,
  /The (user|operation) aborted/i,
  /AbortError/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /auth\/network-request-failed/i,
  /Could not reach Cloud Firestore backend/i,
  /client is offline/i,
  /NotAllowedError/i, // usuário negou câmera/notificação
];

/** Scripts de extensões e apps embutidos (não são nosso código). */
export const URLS_IGNORADAS: RegExp[] = [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const TELEFONE = /(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;
const TOKEN_LONGO = /\b(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|[A-Za-z0-9_-]{40,})\b/g;

/** Apaga e-mail, CPF, telefone e tokens de um texto. */
export function limparTexto(texto: string): string {
  return texto
    .replace(EMAIL, "[email]")
    .replace(TOKEN_LONGO, "[token]")
    .replace(CPF, "[cpf]")
    .replace(TELEFONE, "[telefone]");
}

/** Mantém o caminho da página e descarta a query (códigos, oobCode, buscas). */
export function limparUrl(url: string): string {
  const semHash = url.split("#")[0];
  const [base, query] = semHash.split("?");
  return limparTexto(query ? `${base}?[removido]` : base);
}

function limparValor(valor: unknown, profundidade = 0): unknown {
  if (typeof valor === "string") return limparTexto(valor);
  if (profundidade > 4 || valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map((v) => limparValor(v, profundidade + 1));
  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor)) {
    saida[chave] = /senha|password|token|authorization|cookie|email|cpf|telefone|nome|oobcode|codigo/i.test(chave)
      ? "[removido]"
      : limparValor(v, profundidade + 1);
  }
  return saida;
}

/** Último filtro antes de enviar qualquer erro. */
export function filtrarEvento(evento: ErrorEvent): ErrorEvent | null {
  if (evento.user) evento.user = evento.user.id ? { id: String(evento.user.id) } : undefined;

  if (evento.request) {
    if (evento.request.url) evento.request.url = limparUrl(evento.request.url);
    delete evento.request.cookies;
    delete evento.request.data;
    delete evento.request.query_string;
    if (evento.request.headers) {
      // Só o navegador/aparelho (ajuda a reproduzir) e a página de origem, sem query.
      const mantidos: Record<string, string> = {};
      for (const [nome, valor] of Object.entries(evento.request.headers)) {
        const chave = nome.toLowerCase();
        if (chave === "user-agent") mantidos["user-agent"] = valor;
        if (chave === "referer") mantidos.referer = limparUrl(valor);
      }
      evento.request.headers = mantidos;
    }
  }

  if (evento.message) evento.message = limparTexto(evento.message);
  for (const ex of evento.exception?.values ?? []) {
    if (ex.value) ex.value = limparTexto(ex.value);
  }
  if (evento.extra) evento.extra = limparValor(evento.extra) as typeof evento.extra;
  if (evento.contexts) evento.contexts = limparValor(evento.contexts) as typeof evento.contexts;
  if (evento.breadcrumbs) evento.breadcrumbs = evento.breadcrumbs.map(filtrarRastro).filter((b): b is Breadcrumb => b !== null);
  return evento;
}

/** Rastro (o que o usuário fez antes do erro): URLs sem query, textos limpos. */
export function filtrarRastro(rastro: Breadcrumb): Breadcrumb | null {
  // Console é ruidoso e pode conter dados; os erros reais já chegam por exceção.
  if (rastro.category === "console" && rastro.level !== "error") return null;
  const r = { ...rastro };
  if (r.message) r.message = limparTexto(r.message);
  if (r.data) {
    const dados = { ...r.data };
    for (const k of ["url", "from", "to"]) {
      if (typeof dados[k] === "string") dados[k] = limparUrl(dados[k] as string);
    }
    r.data = limparValor(dados) as typeof r.data;
  }
  return r;
}

/** Opções comuns a todos os ambientes. */
export const opcoesBase = {
  dsn: SENTRY_DSN,
  enabled: monitorLigado,
  environment: ambienteMonitor,
  sendDefaultPii: false,
  // Performance em amostra pequena: cabe folgado no plano grátis.
  tracesSampleRate: 0.05,
  ignoreErrors: ERROS_IGNORADOS,
  beforeSend: filtrarEvento,
  beforeBreadcrumb: (b: Breadcrumb) => filtrarRastro(b),
};
