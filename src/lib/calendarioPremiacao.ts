/**
 * Calendário anual de premiação: os trimestres do ano, a data de cada
 * premiação e quantos dias antes dela o ranking some para os atletas.
 *
 * Com ele ativo, o sistema (agendador a cada 5 min + ao salvar):
 * - troca o trimestre do ranking sozinho, e
 * - liga/desliga a ocultação do ranking nas datas certas.
 *
 * Tudo aqui é puro (datas civis "YYYY-MM-DD" no horário de Brasília).
 */

export interface TrimestreCalendario {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  /** Dia da premiação (opcional). */
  premiacao: string;
}

export interface CalendarioPremiacaoDoc {
  ativo: boolean;
  /** Dias antes da premiação em que o ranking fica oculto (0 = não ocultar). */
  diasOcultos: number;
  mensagem: string;
  trimestres: TrimestreCalendario[];
  atualizadoEm?: unknown;
  atualizadoPor?: string;
}

export const DIAS_OCULTOS_PADRAO = 7;
export const DIAS_OCULTOS_MAXIMO = 60;
export const MENSAGEM_PADRAO = "O ranking está em fechamento para a premiação. Ele volta logo depois da entrega.";

export const CALENDARIO_PADRAO: CalendarioPremiacaoDoc = {
  ativo: false,
  diasOcultos: DIAS_OCULTOS_PADRAO,
  mensagem: MENSAGEM_PADRAO,
  trimestres: [],
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(v: unknown): v is string {
  if (typeof v !== "string" || !DATA.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Soma dias a uma data civil. */
export function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export function hojeBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function normalizarCalendario(valor?: Partial<CalendarioPremiacaoDoc> | null): CalendarioPremiacaoDoc {
  const dias = Number(valor?.diasOcultos);
  return {
    ativo: valor?.ativo === true,
    diasOcultos: Number.isFinite(dias) ? Math.min(DIAS_OCULTOS_MAXIMO, Math.max(0, Math.round(dias))) : DIAS_OCULTOS_PADRAO,
    mensagem: typeof valor?.mensagem === "string" && valor.mensagem.trim() ? valor.mensagem : MENSAGEM_PADRAO,
    trimestres: Array.isArray(valor?.trimestres)
      ? valor.trimestres
          .filter((t) => t && typeof t === "object")
          .map((t, i) => ({
            id: typeof t.id === "string" && t.id ? t.id : `t${i + 1}`,
            nome: typeof t.nome === "string" ? t.nome : "",
            inicio: typeof t.inicio === "string" ? t.inicio : "",
            fim: typeof t.fim === "string" ? t.fim : "",
            premiacao: typeof t.premiacao === "string" ? t.premiacao : "",
          }))
      : [],
    atualizadoEm: valor?.atualizadoEm,
    atualizadoPor: valor?.atualizadoPor,
  };
}

/** Os 4 trimestres do calendário de um ano, já com nome. A premiação fica em branco. */
export function gerarTrimestresDoAno(ano: number): TrimestreCalendario[] {
  const fimDoMes = (m: number) => new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return [1, 2, 3, 4].map((q) => {
    const mesIni = (q - 1) * 3 + 1;
    const mesFim = mesIni + 2;
    const mm = (m: number) => String(m).padStart(2, "0");
    return {
      id: `${ano}-t${q}`,
      nome: `${q}º trimestre ${ano}`,
      inicio: `${ano}-${mm(mesIni)}-01`,
      fim: `${ano}-${mm(mesFim)}-${fimDoMes(mesFim)}`,
      premiacao: "",
    };
  });
}

export function ordenarTrimestres(lista: readonly TrimestreCalendario[]) {
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Problemas por trimestre (id → mensagem) e gerais. Vazio = pode salvar. */
export function validarCalendario(cal: CalendarioPremiacaoDoc): { porTrimestre: Record<string, string>; geral: string | null } {
  const porTrimestre: Record<string, string> = {};
  for (const t of cal.trimestres) {
    if (!t.nome.trim()) porTrimestre[t.id] = "Dê um nome ao trimestre.";
    else if (!dataValida(t.inicio) || !dataValida(t.fim)) porTrimestre[t.id] = "Informe o início e o fim.";
    else if (t.fim < t.inicio) porTrimestre[t.id] = "O fim precisa ser depois do início.";
    else if (t.premiacao && !dataValida(t.premiacao)) porTrimestre[t.id] = "Data da premiação inválida.";
    else if (t.premiacao && t.premiacao < t.inicio) porTrimestre[t.id] = "A premiação precisa ser depois do início do trimestre.";
  }
  const ordenados = ordenarTrimestres(cal.trimestres);
  for (let i = 1; i < ordenados.length; i++) {
    const anterior = ordenados[i - 1];
    const atual = ordenados[i];
    if (!porTrimestre[atual.id] && !porTrimestre[anterior.id] && atual.inicio <= anterior.fim) {
      porTrimestre[atual.id] = `Começa antes de terminar o “${anterior.nome}”.`;
    }
  }
  let geral: string | null = null;
  if (cal.ativo && cal.trimestres.length === 0) geral = "Cadastre ao menos um trimestre para usar o calendário.";
  return { porTrimestre, geral };
}

/** Quando o ranking fica oculto por causa de uma premiação (inclusive nos dois dias). */
export function janelaDaPremiacao(t: TrimestreCalendario, diasOcultos: number) {
  if (!t.premiacao || diasOcultos <= 0) return null;
  return { inicio: somarDias(t.premiacao, -diasOcultos), fim: t.premiacao };
}

/**
 * Trimestre que vale agora no ranking. Depois do fim, ele continua valendo
 * até a premiação (para o comitê conferir o resultado final); só então o
 * seguinte assume. Sem nenhum em andamento, `null`.
 */
export function trimestreVigente(cal: CalendarioPremiacaoDoc, hoje: string): TrimestreCalendario | null {
  for (const t of ordenarTrimestres(cal.trimestres)) {
    const encerra = t.premiacao && t.premiacao > t.fim ? t.premiacao : t.fim;
    if (t.inicio <= hoje && hoje <= encerra) return t;
  }
  return null;
}

/** A ocultação em curso ou a próxima (é o que fica programado no ranking). */
export function proximaOcultacao(cal: CalendarioPremiacaoDoc, hoje: string) {
  const janelas = ordenarTrimestres(cal.trimestres)
    .map((t) => ({ trimestre: t, janela: janelaDaPremiacao(t, cal.diasOcultos) }))
    .filter((x): x is { trimestre: TrimestreCalendario; janela: { inicio: string; fim: string } } => x.janela !== null)
    .filter((x) => x.janela.fim >= hoje)
    .sort((a, b) => a.janela.inicio.localeCompare(b.janela.inicio));
  return janelas[0] ?? null;
}

/** O que o sistema deve aplicar hoje. */
export function planoDoCalendario(cal: CalendarioPremiacaoDoc, hoje: string) {
  const vigente = trimestreVigente(cal, hoje);
  const ocultacao = proximaOcultacao(cal, hoje);
  return {
    trimestre: vigente
      ? { ativo: true, nome: vigente.nome.trim(), inicio: vigente.inicio, fim: vigente.fim }
      : { ativo: false, nome: "Trimestre atual", inicio: "", fim: "" },
    ocultacao: ocultacao
      ? { ativo: true, inicio: ocultacao.janela.inicio, fim: ocultacao.janela.fim, trimestreNome: ocultacao.trimestre.nome }
      : null,
    oculto: Boolean(ocultacao && ocultacao.janela.inicio <= hoje && hoje <= ocultacao.janela.fim),
  };
}
