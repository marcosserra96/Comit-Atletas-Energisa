import type { Role } from "@/lib/types";

export type PermissaoChave =
  | "inicio"
  | "atletas"
  | "regras"
  | "registrar"
  | "eventos"
  | "noticias"
  | "financeiro";

export const PERMISSAO_LABEL: Record<PermissaoChave, string> = {
  inicio: "Início (visão estratégica)",
  atletas: "Atletas (gestão de base)",
  regras: "Critérios de pontuação",
  registrar: "Registrar (lançamento de pontos)",
  eventos: "Eventos",
  noticias: "Notícias",
  financeiro: "Financeiro (acesso e edição)",
};

export const PERMISSAO_ORDEM: PermissaoChave[] = [
  "inicio",
  "atletas",
  "regras",
  "registrar",
  "eventos",
  "noticias",
  "financeiro",
];

/** Permissões padrão para um Comitê recém-criado, sem nada configurado ainda. */
export const PERMISSOES_PADRAO: PermissaoChave[] = ["inicio"];

export const PERFIS_RAPIDOS: Record<string, { label: string; permissoes: PermissaoChave[] }> = {
  consulta: { label: "Consulta", permissoes: ["inicio"] },
  pontuacao: { label: "Comitê Pontuação", permissoes: ["inicio", "regras", "registrar"] },
  financeiro: { label: "Comitê Financeiro", permissoes: ["inicio", "financeiro"] },
  gestao: { label: "Comitê Gestão", permissoes: ["inicio", "atletas"] },
  geral: {
    label: "Comitê Geral",
    permissoes: ["inicio", "atletas", "regras", "registrar", "eventos", "noticias", "financeiro"],
  },
};

export function temPermissao(
  usuario: { role: Role; permissoes?: string[] },
  chave: PermissaoChave,
): boolean {
  if (usuario.role === "administrador") return true;
  return (usuario.permissoes ?? PERMISSOES_PADRAO).includes(chave);
}
