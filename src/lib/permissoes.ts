import type { Role } from "@/lib/types";

export type PermissaoChave =
  | "inicio"
  | "atletas"
  | "regras"
  | "registrar"
  | "historicoMensal"
  | "eventos"
  | "noticias"
  | "informativo"
  | "pesquisas"
  | "financeiro";

export const PERMISSAO_LABEL: Record<PermissaoChave, string> = {
  inicio: "Início (visão estratégica)",
  atletas: "Atletas (gestão de base)",
  regras: "Critérios de pontuação",
  registrar: "Registrar (pontos e justificativas)",
  historicoMensal: "Histórico mensal (lançar e editar totais do mês)",
  eventos: "Eventos",
  noticias: "Notícias",
  informativo: "Informativo (gerar e baixar as artes de divulgação)",
  pesquisas: "Pesquisas (criar questionários e ver as respostas)",
  financeiro: "Financeiro (acesso e edição)",
};

export const PERMISSAO_ORDEM: PermissaoChave[] = [
  "inicio",
  "atletas",
  "regras",
  "registrar",
  "historicoMensal",
  "eventos",
  "noticias",
  "informativo",
  "pesquisas",
  "financeiro",
];

/**
 * Permissões que só valem junto com outra (a tela fica dentro da área da outra).
 * O histórico mensal é uma aba de "Lançar pontos", então também exige "Registrar".
 */
export const PERMISSAO_REQUER: Partial<Record<PermissaoChave, PermissaoChave>> = {
  historicoMensal: "registrar",
};

/** Permissões padrão para um Comitê recém-criado, sem nada configurado ainda. */
export const PERMISSOES_PADRAO: PermissaoChave[] = ["inicio"];

export const PERFIS_RAPIDOS: Record<string, { label: string; permissoes: PermissaoChave[] }> = {
  consulta: { label: "Consulta", permissoes: ["inicio"] },
  pontuacao: { label: "Comitê Pontuação", permissoes: ["inicio", "regras", "registrar"] },
  financeiro: { label: "Comitê Financeiro", permissoes: ["inicio", "financeiro"] },
  gestao: { label: "Comitê Gestão", permissoes: ["inicio", "atletas"] },
  geral: {
    label: "Comitê Geral",
    permissoes: ["inicio", "atletas", "regras", "registrar", "eventos", "noticias", "informativo", "pesquisas", "financeiro"],
  },
};

export function temPermissao(
  usuario: { role: Role; permissoes?: string[] },
  chave: PermissaoChave,
): boolean {
  if (usuario.role === "administrador") return true;
  const permissoes = usuario.permissoes ?? PERMISSOES_PADRAO;
  const requer = PERMISSAO_REQUER[chave];
  return permissoes.includes(chave) && (!requer || permissoes.includes(requer));
}

const ROTA_POR_PERMISSAO: Record<PermissaoChave, string> = {
  inicio: "/gestao",
  atletas: "/gestao/atletas",
  regras: "/gestao/criterios",
  registrar: "/gestao/pontuacao",
  historicoMensal: "/gestao/pontuacao",
  eventos: "/gestao/eventos",
  noticias: "/gestao/noticias",
  informativo: "/gestao/informativo",
  pesquisas: "/gestao/pesquisas",
  financeiro: "/gestao/financeiro",
};

/** Primeira rota que esse usuário realmente tem permissão de ver, na ordem do menu. Null se não tiver nenhuma. */
export function primeiraRotaPermitida(usuario: { role: Role; permissoes?: string[] }): string | null {
  for (const chave of PERMISSAO_ORDEM) {
    if (temPermissao(usuario, chave)) return ROTA_POR_PERMISSAO[chave];
  }
  return null;
}
