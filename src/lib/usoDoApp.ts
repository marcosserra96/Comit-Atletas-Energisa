import type { Equipe } from "@/lib/types";

/**
 * Quem usa o portal. O "último uso" vem do login do Firebase: a data da última
 * renovação da sessão (acontece ao abrir o app, no máximo de hora em hora) ou
 * do último login, o que for mais recente.
 */

export interface PessoaUso {
  atletaId: string;
  nome: string;
  email: string | null;
  equipe: Equipe;
  ativo: boolean;
  /** Tem login vinculado ao cadastro. */
  temConta: boolean;
  /** ISO; null = nunca registrado. */
  ultimoUso: string | null;
  /** Primeiro acesso (criação da conta), ISO. */
  contaCriadaEm: string | null;
  /** Notificações ativas em pelo menos um aparelho. */
  notificacoes: boolean;
  fotoVersao?: number | null;
}

export type FaixaUso = "semana" | "mes" | "sumido" | "nunca";

const DIA = 86_400_000;

export const FAIXAS_USO: Record<FaixaUso, { rotulo: string; descricao: string }> = {
  semana: { rotulo: "Usaram nesta semana", descricao: "Abriram o portal nos últimos 7 dias" },
  mes: { rotulo: "Usaram no mês", descricao: "Entre 8 e 30 dias atrás" },
  sumido: { rotulo: "Sumidos", descricao: "Sem abrir o portal há mais de 30 dias" },
  nunca: { rotulo: "Nunca entraram", descricao: "Cadastro sem login no portal" },
};

export function faixaDeUso(p: Pick<PessoaUso, "temConta" | "ultimoUso">, agora: number): FaixaUso {
  if (!p.temConta || !p.ultimoUso) return "nunca";
  const dias = (agora - new Date(p.ultimoUso).getTime()) / DIA;
  if (dias <= 7) return "semana";
  if (dias <= 30) return "mes";
  return "sumido";
}

export function textoUltimoUso(p: Pick<PessoaUso, "temConta" | "ultimoUso">, agora: number) {
  if (!p.temConta) return "Ainda não tem login";
  if (!p.ultimoUso) return "Nunca abriu o portal";
  const dias = Math.floor((agora - new Date(p.ultimoUso).getTime()) / DIA);
  if (dias <= 0) return "Usou hoje";
  if (dias === 1) return "Usou ontem";
  if (dias < 14) return `Usou há ${dias} dias`;
  if (dias < 60) return `Usou há ${Math.floor(dias / 7)} semanas`;
  const meses = Math.floor(dias / 30);
  return `Usou há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/** Quem entra na conta do programa: atletas de corrida e bike (e quem está na fila, se pedido). */
export function participaDoPrograma(equipe: Equipe, incluirFila: boolean) {
  return equipe === "corrida" || equipe === "bicicleta" || (incluirFila && (equipe === "fila_corrida" || equipe === "fila_bicicleta"));
}

export function resumoDeUso(pessoas: readonly PessoaUso[], agora: number) {
  const contagem: Record<FaixaUso, number> = { semana: 0, mes: 0, sumido: 0, nunca: 0 };
  for (const p of pessoas) contagem[faixaDeUso(p, agora)] += 1;
  return { total: pessoas.length, ...contagem, notificacoes: pessoas.filter((p) => p.notificacoes).length };
}

/** Mensagem de convite para quem ainda não entrou (WhatsApp ou e-mail). */
export function mensagemDeConvite(nome: string, urlPortal: string) {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return [
    `Oi, ${primeiro}! Tudo bem?`,
    "",
    "O portal dos Atletas Energisa já está no ar: lá você acompanha seus treinos, pontos, ranking, agenda de provas e conquistas.",
    "",
    `Para entrar, acesse ${urlPortal} e toque em "Solicitar acesso" com o seu e-mail. Assim que o comitê liberar, você recebe o aviso.`,
    "",
    "Dica: depois de entrar, adicione o portal à tela inicial do celular e ative as notificações.",
  ].join("\n");
}
