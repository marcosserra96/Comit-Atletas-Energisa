import { temPermissao } from "@/lib/permissoes";
import type { Role } from "@/lib/types";

interface UsuarioParaTeste {
  role: Role;
  permissoes?: string[];
}

export interface CenarioPermissao {
  chave: string;
  categoria: string;
  label: string;
  regra: string;
  permitido: boolean;
}

interface CenarioDef {
  chave: string;
  categoria: string;
  label: string;
  regra: string;
  avaliar: (u: UsuarioParaTeste) => boolean;
}

/**
 * Espelha, cenário a cenário, a lógica de firestore.rules — não substitui um
 * teste real contra o Firestore, mas usa exatamente as mesmas condições
 * (mesmas chaves de permissão) hoje aplicadas pelas regras publicadas.
 */
const CENARIOS: CenarioDef[] = [
  {
    chave: "ver_atletas",
    categoria: "Atletas",
    label: "Ver lista de atletas e abrir fichas",
    regra: "Leitura liberada a qualquer usuário autenticado.",
    avaliar: () => true,
  },
  {
    chave: "cadastrar_atleta",
    categoria: "Atletas",
    label: "Cadastrar novo atleta",
    regra: "Requer a permissão \"Atletas\".",
    avaliar: (u) => temPermissao(u, "atletas"),
  },
  {
    chave: "editar_atleta",
    categoria: "Atletas",
    label: "Editar cadastro do atleta (dados, equipe, ativo)",
    regra: "Requer a permissão \"Atletas\" (o campo \"perfil/role\" continua exclusivo do administrador).",
    avaliar: (u) => temPermissao(u, "atletas"),
  },
  {
    chave: "comentar_atleta",
    categoria: "Atletas",
    label: "Comentar / registrar observação na ficha",
    regra: "Requer a permissão \"Atletas\" ou \"Registrar\".",
    avaliar: (u) => temPermissao(u, "atletas") || temPermissao(u, "registrar"),
  },
  {
    chave: "ver_auditoria_atleta",
    categoria: "Atletas",
    label: "Ver auditoria da ficha do atleta",
    regra: "Requer a permissão \"Atletas\".",
    avaliar: (u) => temPermissao(u, "atletas"),
  },
  {
    chave: "lancar_pontos",
    categoria: "Pontuação",
    label: "Lançar ou estornar pontos",
    regra: "Requer a permissão \"Registrar\".",
    avaliar: (u) => temPermissao(u, "registrar"),
  },
  {
    chave: "atualizar_pontuacao_total",
    categoria: "Pontuação",
    label: "Atualizar a pontuação total do atleta",
    regra: "Requer a permissão \"Atletas\" ou \"Registrar\" (efeito colateral do lançamento de pontos).",
    avaliar: (u) => temPermissao(u, "atletas") || temPermissao(u, "registrar"),
  },
  {
    chave: "gerir_eventos",
    categoria: "Eventos",
    label: "Criar, editar ou apagar eventos da agenda",
    regra: "Requer a permissão \"Eventos\".",
    avaliar: (u) => temPermissao(u, "eventos"),
  },
  {
    chave: "gerir_noticias",
    categoria: "Notícias",
    label: "Publicar ou editar notícias",
    regra: "Requer a permissão \"Notícias\".",
    avaliar: (u) => temPermissao(u, "noticias"),
  },
  {
    chave: "gerir_financeiro",
    categoria: "Financeiro",
    label: "Ver e registrar despesas financeiras",
    regra: "Requer a permissão \"Financeiro\".",
    avaliar: (u) => temPermissao(u, "financeiro"),
  },
];

export function avaliarPermissoes(u: UsuarioParaTeste): CenarioPermissao[] {
  return CENARIOS.map(({ avaliar, ...resto }) => ({ ...resto, permitido: avaliar(u) }));
}
