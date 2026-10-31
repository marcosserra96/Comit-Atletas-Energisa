/**
 * Avisos automáticos pessoais (pontos, ranking, pedidos para o comitê):
 * regras puras, sem Firebase, usadas pelo servidor e testadas à parte.
 */

// ---------- preferências ----------

/** Tipos de aviso que cada pessoa pode ligar ou desligar. */
export type TipoAviso = "pontos" | "ranking" | "conquistas" | "resumo_mes" | "eventos" | "lembrete_treino" | "comite_acesso" | "comite_justificativa" | "comite_senha";

export type PreferenciasAviso = Record<TipoAviso, boolean>;

export const PREFERENCIAS_PADRAO: PreferenciasAviso = {
  pontos: true,
  ranking: true,
  conquistas: true,
  resumo_mes: true,
  eventos: true,
  lembrete_treino: true,
  comite_acesso: true,
  comite_justificativa: true,
  comite_senha: true,
};

export const TIPO_AVISO_INFO: Record<TipoAviso, { titulo: string; texto: string }> = {
  pontos: { titulo: "Pontos lançados", texto: "Quando o comitê lançar pontos para você." },
  ranking: { titulo: "Ultrapassagem no ranking", texto: "Quando alguém passar você no ranking do trimestre." },
  conquistas: { titulo: "Conquistas", texto: "Quando você ganhar uma medalha nova, inclusive de desafio." },
  eventos: { titulo: "Lembrete de evento", texto: "Na véspera dos eventos em que você confirmou presença." },
  lembrete_treino: { titulo: "Convite para voltar a treinar", texto: "Depois de 3 semanas sem treino, um convite para voltar (no máximo um por mês)." },
  resumo_mes: { titulo: "Resumo do mês, do trimestre e do ano", texto: "Quando cada um fechar, como foi, com a imagem pronta para compartilhar." },
  comite_acesso: { titulo: "Pedido de acesso", texto: "Quando alguém pedir para entrar no portal." },
  comite_justificativa: { titulo: "Justificativa de ausência", texto: "Quando um atleta enviar uma justificativa para analisar." },
  comite_senha: { titulo: "Pedido de nova senha", texto: "Quando alguém não conseguir entrar e pedir ajuda." },
};

export const TIPOS_ATLETA: TipoAviso[] = ["pontos", "ranking", "conquistas", "eventos", "resumo_mes", "lembrete_treino"];
export const TIPOS_COMITE: TipoAviso[] = ["comite_acesso", "comite_justificativa", "comite_senha"];

export function normalizarPreferencias(valor: unknown): PreferenciasAviso {
  const v = (valor && typeof valor === "object" ? valor : {}) as Partial<Record<TipoAviso, unknown>>;
  const out = { ...PREFERENCIAS_PADRAO };
  for (const tipo of Object.keys(PREFERENCIAS_PADRAO) as TipoAviso[]) {
    if (typeof v[tipo] === "boolean") out[tipo] = v[tipo] as boolean;
  }
  return out;
}

/** Quem do comitê recebe cada aviso: só quem consegue resolver o pedido. */
export function podeReceberAvisoComite(
  usuario: { role?: string; permissoes?: string[] },
  tipo: Extract<TipoAviso, `comite_${string}`>,
) {
  if (usuario.role === "administrador") return true;
  if (usuario.role !== "comite") return false;
  const p = usuario.permissoes ?? [];
  if (tipo === "comite_acesso") return false; // a aba de pedidos de acesso é só do administrador
  if (tipo === "comite_justificativa") return p.includes("registrar");
  return p.includes("atletas");
}

// ---------- pontos lançados ----------

export interface LancamentoParaAviso {
  atletaId: string;
  pontos: number;
  estornado?: boolean;
  tipoLancamento?: string;
  origemPresenca?: string;
  descricaoLote?: string;
  regraDesc?: string;
  dataTreino?: string;
}

/**
 * Agrupa os lançamentos novos por atleta. Ficam de fora: estornos, pontos
 * zerados ou negativos, importação de planilha antiga (seria uma avalanche de
 * avisos de pontos velhos) e a presença que o próprio atleta confirmou pelo QR
 * (ele acabou de ver a confirmação na tela).
 */
export function resumirPontosPorAtleta(lancamentos: readonly LancamentoParaAviso[]) {
  const porAtleta = new Map<string, { total: number; motivos: string[]; datas: string[] }>();
  for (const l of lancamentos) {
    if (!l.atletaId || l.estornado || !(l.pontos > 0)) continue;
    if (l.tipoLancamento === "importacao") continue;
    if (l.origemPresenca === "qrcode") continue;
    const atual = porAtleta.get(l.atletaId) ?? { total: 0, motivos: [], datas: [] };
    atual.total += l.pontos;
    const motivo = (l.descricaoLote || l.regraDesc || "").trim();
    if (motivo && !atual.motivos.includes(motivo)) atual.motivos.push(motivo);
    if (l.dataTreino && !atual.datas.includes(l.dataTreino)) atual.datas.push(l.dataTreino);
    porAtleta.set(l.atletaId, atual);
  }
  return porAtleta;
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function mensagemDePontos(resumo: { total: number; motivos: string[]; datas: string[] }) {
  const n = resumo.total;
  const motivos =
    resumo.motivos.length === 0
      ? "Confira no seu desempenho."
      : resumo.motivos.length === 1
        ? resumo.motivos[0]
        : `${resumo.motivos.slice(0, 2).join(", ")}${resumo.motivos.length > 2 ? ` e mais ${resumo.motivos.length - 2}` : ""}`;
  const quando = resumo.datas.length === 1 ? ` · ${dataCurta(resumo.datas[0])}` : "";
  return {
    titulo: `Você ganhou ${n} ${n === 1 ? "ponto" : "pontos"}`,
    corpo: `${motivos}${quando}`.slice(0, 180),
  };
}

// ---------- ultrapassagens no ranking ----------

export interface LinhaRankingAviso {
  atletaId: string;
  nome: string;
  pontos: number;
  /** false = perfil oculto nas listas: o nome não vai na mensagem. */
  visivel: boolean;
}

/** Posições com empate denso (1, 1, 2, 3), igual ao ranking do portal. */
export function posicoesDoRanking(linhas: readonly LinhaRankingAviso[]) {
  const ordenadas = [...linhas].filter((l) => l.pontos > 0).sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));
  const posicoes: Record<string, number> = {};
  let pos = 0;
  let anterior: number | undefined;
  for (const l of ordenadas) {
    if (l.pontos !== anterior) pos += 1;
    anterior = l.pontos;
    posicoes[l.atletaId] = pos;
  }
  return { ordenadas, posicoes };
}

export interface Ultrapassagem {
  atletaId: string;
  posicaoAntes: number;
  posicaoAgora: number;
  /** Quem passou, na ordem do ranking (nomes já protegidos). */
  quem: string[];
  /** Pontos que faltam para alcançar quem está logo à frente. */
  faltam: number;
}

/** "Amanda Cristina de Almeida Prado" → "Amanda Prado". */
export function nomeParaAviso(nome: string) {
  const partes = nome.trim().split(/\s+/).filter((p) => !["de", "da", "do", "das", "dos", "e"].includes(p.toLowerCase()));
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(" ");
}

/**
 * Quem caiu de posição porque alguém que estava atrás (ou empatado, ou fora
 * do ranking) agora está à frente. Empatar não é ultrapassar.
 */
export function detectarUltrapassagens(anterior: Record<string, number>, linhas: readonly LinhaRankingAviso[]): Ultrapassagem[] {
  const { ordenadas, posicoes } = posicoesDoRanking(linhas);
  const out: Ultrapassagem[] = [];
  for (const eu of ordenadas) {
    const antes = anterior[eu.atletaId];
    const agora = posicoes[eu.atletaId];
    if (!antes || agora <= antes) continue;
    const passaram = ordenadas.filter((o) => {
      if (o.atletaId === eu.atletaId || posicoes[o.atletaId] >= agora) return false;
      const oAntes = anterior[o.atletaId];
      return oAntes === undefined || oAntes >= antes;
    });
    if (passaram.length === 0) continue;
    const logoAFrente = ordenadas.filter((o) => posicoes[o.atletaId] === agora - 1)[0];
    out.push({
      atletaId: eu.atletaId,
      posicaoAntes: antes,
      posicaoAgora: agora,
      quem: passaram.map((o) => (o.visivel ? nomeParaAviso(o.nome) : "um colega")),
      faltam: logoAFrente ? logoAFrente.pontos - eu.pontos : 0,
    });
  }
  return out;
}

export function mensagemDeUltrapassagem(u: Ultrapassagem) {
  const nomes = [...new Set(u.quem)];
  const titulo =
    nomes.length === 1
      ? nomes[0] === "um colega"
        ? "Alguém passou você no ranking"
        : `${nomes[0]} passou você no ranking`
      : `${nomes.length} atletas passaram você no ranking`;
  const faltam = u.faltam > 0 ? ` Faltam ${u.faltam} ${u.faltam === 1 ? "ponto" : "pontos"} para subir.` : "";
  return { titulo: titulo.slice(0, 60), corpo: `Agora você está em ${u.posicaoAgora}º.${faltam} Bora treinar!` };
}

/** Intervalo mínimo entre dois avisos de ultrapassagem para a mesma pessoa. */
export const INTERVALO_AVISO_RANKING_MS = 12 * 60 * 60_000;

// ---------- pedidos para o comitê ----------

export function mensagemDePedidos(tipo: "comite_acesso" | "comite_justificativa" | "comite_senha", nomes: string[]) {
  const n = nomes.length;
  const primeiro = nomes[0] ?? "";
  if (tipo === "comite_acesso") {
    return {
      titulo: n === 1 ? "Novo pedido de acesso" : `${n} pedidos de acesso novos`,
      corpo: n === 1 ? `${primeiro} quer entrar no portal. Toque para aprovar ou recusar.` : `${nomes.slice(0, 3).join(", ")}${n > 3 ? " e mais" : ""} querem entrar no portal.`,
      link: "/gestao/atletas?tab=pendentes",
    };
  }
  if (tipo === "comite_justificativa") {
    return {
      titulo: n === 1 ? "Nova justificativa de ausência" : `${n} justificativas novas`,
      corpo: n === 1 ? `${primeiro} enviou uma justificativa para analisar.` : `${nomes.slice(0, 3).join(", ")}${n > 3 ? " e mais" : ""} enviaram justificativas.`,
      link: "/gestao/pontuacao?tab=justificativas",
    };
  }
  return {
    titulo: n === 1 ? "Pedido de nova senha" : `${n} pedidos de nova senha`,
    corpo: n === 1 ? `${primeiro} não consegue entrar e pediu ajuda.` : `${nomes.slice(0, 3).join(", ")}${n > 3 ? " e mais" : ""} pediram ajuda para entrar.`,
    link: "/gestao",
  };
}

// ---------- conquistas ----------

export function mensagemDeConquista(titulos: string[]) {
  if (titulos.length === 1) return { titulo: "Nova conquista!", corpo: `Você ganhou a medalha "${titulos[0]}". Veja no seu desempenho.` };
  return { titulo: `${titulos.length} conquistas novas!`, corpo: `Você ganhou: ${titulos.slice(0, 3).join(", ")}${titulos.length > 3 ? " e mais" : ""}.`.slice(0, 180) };
}

// ---------- acesso liberado ----------

/** "Seu acesso foi liberado!" · "Boas-vindas ao Atletas Energisa, Ana. Toque para entrar no portal." */
export function mensagemDeAcessoLiberado(nome: string) {
  const primeiro = nome.trim().split(/\s+/)[0];
  return {
    titulo: "Seu acesso foi liberado!",
    corpo: `Boas-vindas ao Atletas Energisa${primeiro ? `, ${primeiro}` : ""}. Toque para entrar no portal.`,
  };
}

// ---------- véspera do evento ----------

/** Hora de Brasília a partir da qual sai o lembrete da véspera. */
export const HORA_DA_VESPERA = 18;

function brasilia(agora: number) {
  const b = new Date(agora - 3 * 60 * 60_000);
  return { hoje: b.toISOString().slice(0, 10), hora: b.getUTCHours() };
}

function somarDiasIso(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** O evento é amanhã e já passou das 18h de hoje (Brasília)? */
export function ehHoraDaVespera(dataDoEvento: string, agora: number) {
  const { hoje, hora } = brasilia(agora);
  return dataDoEvento === somarDiasIso(hoje, 1) && hora >= HORA_DA_VESPERA;
}

/** "Amanhã: Corrida Unimed" · "Você confirmou presença, às 7h, em Parque das Águas. Bom evento!" */
export function mensagemDeVespera(e: { titulo: string; local?: string; horaInicio?: string; reuniao?: boolean; online?: boolean }) {
  const hora = e.horaInicio ? `, às ${e.horaInicio}` : "";
  const onde = e.online ? ", online" : e.local?.trim() ? `, em ${e.local.trim()}` : "";
  return {
    titulo: `Amanhã: ${e.titulo}`.slice(0, 60),
    corpo: `Você confirmou presença${hora}${onde}. ${e.reuniao ? "Até lá!" : "Bom evento!"}`.slice(0, 180),
  };
}

// ---------- convite para voltar a treinar ----------

/** A partir de quantos dias sem treino o atleta recebe o convite. */
export const DIAS_SEM_TREINO = 21;
/** Depois disso, a pessoa provavelmente saiu do programa: não insiste. */
export const DIAS_SEM_TREINO_MAXIMO = 120;
/** Intervalo mínimo entre dois convites para a mesma pessoa. */
export const DIAS_ENTRE_CONVITES = 30;

/**
 * Convida quem está parado entre 3 semanas e 4 meses, sem ausência
 * justificada no período e sem convite nos últimos 30 dias.
 */
export function precisaConviteParaTreinar(p: { ultimaAtividade: string | null; hoje: string; ultimoConvite?: string | null; ausenciaJustificada: boolean }) {
  if (!p.ultimaAtividade || p.ausenciaJustificada) return false;
  const dias = Math.round((Date.parse(`${p.hoje}T12:00:00Z`) - Date.parse(`${p.ultimaAtividade}T12:00:00Z`)) / 86_400_000);
  if (dias < DIAS_SEM_TREINO || dias > DIAS_SEM_TREINO_MAXIMO) return false;
  if (p.ultimoConvite && Math.round((Date.parse(`${p.hoje}T12:00:00Z`) - Date.parse(`${p.ultimoConvite}T12:00:00Z`)) / 86_400_000) < DIAS_ENTRE_CONVITES) return false;
  return true;
}

/** "Sentimos sua falta, Ana" · "Faz 3 semanas do seu último treino…" */
export function mensagemDeConvite(nome: string, ultimaAtividade: string, hoje: string) {
  const primeiro = nome.trim().split(/\s+/)[0];
  const semanas = Math.floor(Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${ultimaAtividade}T12:00:00Z`)) / 86_400_000) / 7);
  return {
    titulo: `Sentimos sua falta${primeiro ? `, ${primeiro}` : ""}`.slice(0, 60),
    corpo: `Faz ${semanas} semanas do seu último treino. Que tal voltar esta semana? Veja os próximos treinos e provas na agenda.`,
  };
}
