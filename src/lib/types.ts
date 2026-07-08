export type Role = "atleta" | "comite" | "administrador";

export type Modalidade = "corrida" | "bicicleta";

export type Equipe =
  | Modalidade
  | "fila_corrida"
  | "fila_bicicleta"
  | "comite"
  | "nenhuma";

/**
 * Registro de atleta/staff. Não é mais chaveado pelo uid do Auth — o Comitê
 * pode cadastrar um atleta sem login (authUid null) e o Administrador
 * posteriormente vincula esse registro a uma conta criada em "Solicitar acesso".
 */
export interface AtletaDoc {
  id: string;
  nome: string;
  email: string | null;
  sexo?: "M" | "F" | "Outro";
  dataNascimento?: string;
  localidade?: string;
  anoEntrada?: number;
  role: Role | null;
  equipe: Equipe;
  ativo: boolean;
  pontuacaoTotal: number;
  authUid: string | null;
  criadoEm: unknown;
  atualizadoEm: unknown;
  criadoPor?: string;
  /** Posição relativa na fila de espera (menor = mais perto de entrar). Só relevante quando equipe é fila_*. */
  ordemFila?: number;
}

/** usuarios/{uid} — ponteiro auth -> atleta, escrito só por staff (nunca pelo próprio usuário). */
export interface UsuarioDoc {
  uid: string;
  role: Role;
  atletaId: string;
  /** Permissões granulares do Comitê (administrador sempre tem acesso total, independente disso). */
  permissoes?: string[];
  criadoEm: unknown;
  atualizadoEm?: unknown;
}

export type SolicitacaoStatus = "pendente" | "vinculado" | "recusado";

export interface SolicitacaoAcessoDoc {
  uid: string;
  nome: string;
  email: string;
  status: SolicitacaoStatus;
  motivoRecusa?: string;
  criadoEm: unknown;
  atualizadoEm?: unknown;
}

export type TipoLancamento = "treino" | "evento" | "avulso" | "importacao";

export interface HistoricoPontoDoc {
  id: string;
  atletaId: string;
  atletaNome: string;
  equipe: Equipe;
  regraId: string;
  regraDesc: string;
  pontos: number;
  kmPercorrido?: number;
  tipoLancamento: TipoLancamento;
  dataTreino: string;
  loteId: string;
  /** Rótulo livre do lote (ex: "Treino de sábado"), preenchido manualmente ou a partir do evento vinculado. */
  descricaoLote?: string;
  /** Evento da agenda ao qual este lançamento está vinculado, se houver. */
  eventoId?: string;
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: unknown;
  estornado: boolean;
  estornadoEm?: unknown;
  estornadoPor?: string;
  motivoEstorno?: string;
}

export interface RegraPontuacaoDoc {
  id: string;
  descricao: string;
  modalidade: "ambas" | Modalidade;
  pontos: number;
  tiposLancamento: TipoLancamento[];
  /** IDs de outras regras que não podem ser pontuadas junto com esta, para o mesmo atleta no mesmo lançamento. */
  regrasExcludentes?: string[];
  criadoEm: unknown;
}

export interface EventoDoc {
  id: string;
  titulo: string;
  local: string;
  modalidade: "ambas" | Modalidade;
  data: string;
  km?: number;
  criadoEm: unknown;
  criadoPor: string;
  /** IDs de atletas confirmados. Cada atleta só pode adicionar/remover o próprio id. */
  inscritos?: string[];
}

export interface NoticiaDoc {
  id: string;
  titulo: string;
  resumo: string;
  corpo: string;
  fixado: boolean;
  autorNome: string;
  autorUid: string;
  criadoEm: unknown;
}

export type CategoriaDespesa =
  | "Provas / Inscrições"
  | "Mensalidade Treinador"
  | "Encontros e Eventos"
  | "Uniformes e Materiais"
  | "Outros";

export interface DespesaDoc {
  id: string;
  categoria: CategoriaDespesa;
  equipe: string;
  evento: string;
  /** Empresa que efetuou o pagamento (texto livre, sem lista fixa). */
  empresaPagadora?: string;
  /** Lançamento não previsto no orçamento — quando true, não entra no "proposto". */
  avulso: boolean;
  /** Detalhamento do valor proposto por tipo de custo (soma vira totalProposto). */
  propInsc?: number;
  propTransp?: number;
  propHosp?: number;
  propAlim?: number;
  propDemais?: number;
  /** Detalhamento do valor realizado por tipo de custo (soma vira totalRealizado). */
  realInsc?: number;
  realTransp?: number;
  realHosp?: number;
  realAlim?: number;
  realDemais?: number;
  totalProposto: number;
  totalRealizado: number;
  /** Observações livres sobre o lançamento. */
  observacoes?: string;
  criadoEm: unknown;
  atualizadoEm?: unknown;
}

export interface ComentarioAtletaDoc {
  id: string;
  atletaId: string;
  texto: string;
  autorNome: string;
  autorUid: string;
  criadoEm: unknown;
}

export type LoginBackgroundStyle = "solido" | "gradiente";

/** configuracoes/branding — identidade visual do portal, lida inclusive por visitantes não autenticados (tela de login). */
export interface BrandingDoc {
  primary: string;
  secondary: string;
  accent: string;
  danger: string;
  loginStyle: LoginBackgroundStyle;
  loginCorInicio: string;
  loginCorFim: string;
  atualizadoEm?: unknown;
  atualizadoPor?: string;
}

export type AlertaCriterio = "sem_treino_mes" | "sem_treino_30d" | "ate_x_treinos" | "ate_x_pontos";

/** configuracoes/informativo — padrão do Informativo do Ranking, definido pelo Administrador. */
export interface InformativoConfigDoc {
  modalidade: "todos" | Modalidade;
  limite: number;
  paginasSeparadas: boolean;
  mostrarKpis: boolean;
  mostrarLegenda: boolean;
  mostrarTop3: boolean;
  mostrarAlertas: boolean;
  mostrarDemais: boolean;
  alertaCriterio: AlertaCriterio;
  alertaValor: number;
  atualizadoEm?: unknown;
  atualizadoPor?: string;
}

export interface AuditoriaDoc {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  dados?: Record<string, unknown>;
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: unknown;
}
