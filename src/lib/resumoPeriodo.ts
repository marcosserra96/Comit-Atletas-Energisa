/**
 * Os períodos do resumo do atleta (a imagem para compartilhar, o destaque no
 * Início e o aviso de "fechou"): o mês, o trimestre do calendário de premiação
 * e, no fim do ano, o ano civil. Funções puras, usadas no app e no servidor.
 */

export type IdPeriodoResumo = "este" | "passado" | "trimestre" | "ano";

export interface PeriodoResumo {
  id: IdPeriodoResumo;
  /** Texto do seletor ("Outubro", "Trimestre", "2026"). */
  rotulo: string;
  /** Título grande da imagem ("Outubro", "3º Trimestre", "2026"). */
  titulo: string;
  /** Linha abaixo do título ("2026", "Set a Nov 2026", "Meu ano no programa"). */
  subtitulo: string;
  /** Como o período entra numa frase: "Seu outubro", "Seu 3º Trimestre", "Seu 2026". */
  nomeNaFrase: string;
  inicio: string;
  /** Último dia contado: o fim do período ou hoje, se ainda não acabou. */
  fim: string;
  /** O período ainda não terminou: os números são até hoje. */
  emAndamento: boolean;
  /** Para o nome do arquivo ("outubro-2026", "3-trimestre-2026", "ano-2026"). */
  arquivo: string;
}

export interface TrimestreDoResumo {
  nome: string;
  inicio: string;
  fim: string;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Dias depois do fim de um trimestre em que ele ainda é "o que acabou de fechar". */
export const DIAS_TRIMESTRE_RECENTE = 15;
/** Até que dia do mês novo o destaque do período que fechou aparece no Início. */
export const DIAS_DO_DESTAQUE = 7;
/** Dias em que o aviso de "fechou" ainda pode sair, se o agendador falhar no primeiro. */
export const DIAS_PARA_O_AVISO = 3;
/** Hora de Brasília a partir da qual o aviso sai: ninguém recebe de madrugada. */
export const HORA_DO_AVISO = 10;

function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** "23/10" */
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/º/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** O mês de `hoje` (deslocamento 0) ou o anterior (−1). */
export function periodoDoMes(hoje: string, deslocamento: 0 | -1): PeriodoResumo {
  const d = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 + deslocamento, 1));
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  const mm = String(mes + 1).padStart(2, "0");
  const ultimo = `${ano}-${mm}-${String(new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()).padStart(2, "0")}`;
  return {
    id: deslocamento === 0 ? "este" : "passado",
    rotulo: MESES[mes],
    titulo: MESES[mes],
    subtitulo: ultimo < hoje ? String(ano) : `${ano} · até ${diaMes(hoje)}`,
    nomeNaFrase: `Seu ${MESES[mes].toLowerCase()}`,
    inicio: `${ano}-${mm}-01`,
    fim: ultimo < hoje ? ultimo : hoje,
    emAndamento: ultimo >= hoje,
    arquivo: `${slug(MESES[mes])}-${ano}`,
  };
}

/**
 * O trimestre da imagem: o que fechou há pouco (até 15 dias), para dar tempo
 * de compartilhar o resultado final; senão, o que está em andamento.
 */
export function trimestreDoResumo(trimestres: readonly TrimestreDoResumo[], hoje: string): TrimestreDoResumo | null {
  const validos = trimestres.filter((t) => t.inicio && t.fim && t.nome.trim());
  const recente = validos
    .filter((t) => t.fim < hoje && diasEntre(t.fim, hoje) <= DIAS_TRIMESTRE_RECENTE)
    .sort((a, b) => b.fim.localeCompare(a.fim))[0];
  return recente ?? validos.find((t) => t.inicio <= hoje && hoje <= t.fim) ?? null;
}

export function periodoDoTrimestre(t: TrimestreDoResumo, hoje: string): PeriodoResumo {
  const nome = t.nome.trim();
  const ano = t.fim.slice(0, 4);
  const i = Number(t.inicio.slice(5, 7)) - 1;
  const f = Number(t.fim.slice(5, 7)) - 1;
  return {
    id: "trimestre",
    rotulo: "Trimestre",
    titulo: nome,
    subtitulo: t.fim < hoje ? `${MESES_CURTOS[i]} a ${MESES_CURTOS[f]} ${ano}` : `${MESES_CURTOS[i]} a ${MESES_CURTOS[f]} · até ${diaMes(hoje)}`,
    nomeNaFrase: `Seu ${nome}`,
    inicio: t.inicio,
    fim: t.fim < hoje ? t.fim : hoje,
    emAndamento: t.fim >= hoje,
    arquivo: slug(/\d{4}/.test(nome) ? nome : `${nome} ${ano}`),
  };
}

/** O ano da imagem: o atual em dezembro, o que acabou em janeiro; fora disso, nenhum. */
export function anoDoResumo(hoje: string) {
  const mes = Number(hoje.slice(5, 7));
  if (mes === 12) return hoje.slice(0, 4);
  if (mes === 1) return String(Number(hoje.slice(0, 4)) - 1);
  return null;
}

export function periodoDoAno(ano: string, hoje: string): PeriodoResumo {
  const fim = `${ano}-12-31`;
  return {
    id: "ano",
    rotulo: ano,
    titulo: ano,
    subtitulo: fim < hoje ? "Meu ano no programa" : `Meu ano até ${diaMes(hoje)}`,
    nomeNaFrase: `Seu ${ano}`,
    inicio: `${ano}-01-01`,
    fim: fim < hoje ? fim : hoje,
    emAndamento: fim >= hoje,
    arquivo: `ano-${ano}`,
  };
}

/** As opções da imagem, na ordem do seletor. */
export function periodosDoResumo(hoje: string, trimestres: readonly TrimestreDoResumo[]): PeriodoResumo[] {
  const lista = [periodoDoMes(hoje, 0), periodoDoMes(hoje, -1)];
  const t = trimestreDoResumo(trimestres, hoje);
  if (t) lista.push(periodoDoTrimestre(t, hoje));
  const ano = anoDoResumo(hoje);
  if (ano) lista.push(periodoDoAno(ano, hoje));
  return lista;
}

/**
 * O que acabou de fechar e merece destaque no Início: o ano (1 a 7 de janeiro),
 * o trimestre (até 7 dias depois do fim) ou o mês (dias 1 a 7). Um só, nessa ordem.
 */
export function periodoQueFechou(hoje: string, trimestres: readonly TrimestreDoResumo[]): PeriodoResumo | null {
  const dia = Number(hoje.slice(8, 10));
  if (hoje.slice(5, 7) === "01" && dia <= DIAS_DO_DESTAQUE) return periodoDoAno(String(Number(hoje.slice(0, 4)) - 1), hoje);
  const t = trimestres
    .filter((x) => x.inicio && x.fim && x.nome.trim() && x.fim < hoje && diasEntre(x.fim, hoje) <= DIAS_DO_DESTAQUE)
    .sort((a, b) => b.fim.localeCompare(a.fim))[0];
  if (t) return periodoDoTrimestre(t, hoje);
  if (dia <= DIAS_DO_DESTAQUE) return periodoDoMes(hoje, -1);
  return null;
}

export interface AvisoDeResumo {
  periodo: PeriodoResumo;
  /** Marcas a gravar (o que este aviso cobre): o mês, o trimestre e o ano. */
  marcas: { mes?: string; trimestre?: string; ano?: string };
  /** Link que abre a imagem já no período. */
  link: string;
}

/**
 * Qual aviso de "fechou" mandar agora, se algum. Sai no dia seguinte ao fim
 * do período, a partir das 10h de Brasília, com folga até o 3º dia. Se mais de
 * um fecha junto (31/12 fecha mês, trimestre e ano), sai só o maior, e os
 * outros ficam marcados como avisados: ninguém recebe dois no mesmo dia.
 * `agora` em milissegundos; Brasília é UTC−3 o ano todo.
 */
export function avisoDeResumoParaEnviar(
  agora: number,
  trimestres: readonly TrimestreDoResumo[],
  enviados: { mes?: string; trimestre?: string; ano?: string },
): AvisoDeResumo | null {
  const b = new Date(agora - 3 * 60 * 60_000);
  const hoje = b.toISOString().slice(0, 10);
  const hora = b.getUTCHours();
  /** O período que terminou em `fim` está na janela do aviso? */
  const naJanela = (fim: string) => {
    const dias = diasEntre(fim, hoje);
    return dias >= 1 && dias <= DIAS_PARA_O_AVISO && (dias > 1 || hora >= HORA_DO_AVISO);
  };

  const mes = periodoDoMes(hoje, -1);
  const mesFechou = naJanela(somarDias(`${hoje.slice(0, 7)}-01`, -1)) ? mes.inicio.slice(0, 7) : null;
  const trimestre = trimestres
    .filter((t) => t.inicio && t.fim && t.nome.trim() && naJanela(t.fim))
    .sort((a, b2) => b2.fim.localeCompare(a.fim))[0];
  const chaveTrimestre = trimestre ? `${trimestre.inicio}:${trimestre.fim}` : null;
  const anoAnterior = String(Number(hoje.slice(0, 4)) - 1);
  const anoFechou = naJanela(`${anoAnterior}-12-31`) ? anoAnterior : null;

  // Tudo o que fecha agora fica marcado junto com o aviso que sair.
  const marcas = {
    ...(mesFechou ? { mes: mesFechou } : {}),
    ...(chaveTrimestre ? { trimestre: chaveTrimestre } : {}),
    ...(anoFechou ? { ano: anoFechou } : {}),
  };
  if (anoFechou && enviados.ano !== anoFechou) return { periodo: periodoDoAno(anoFechou, hoje), marcas, link: "/dashboard?compartilhar=ano" };
  if (trimestre && enviados.trimestre !== chaveTrimestre && enviados.ano !== anoFechou) {
    return { periodo: periodoDoTrimestre(trimestre, hoje), marcas, link: "/dashboard?compartilhar=trimestre" };
  }
  const jaCoberto = (anoFechou && enviados.ano === anoFechou) || (chaveTrimestre && enviados.trimestre === chaveTrimestre);
  if (mesFechou && enviados.mes !== mesFechou && !jaCoberto) return { periodo: mes, marcas, link: "/dashboard?compartilhar=mes" };
  return null;
}

/** "Seu outubro fechou" · "12 treinos e 86 km no mês. Toque para ver o resumo e compartilhar…" */
export function mensagemDoResumo(r: { periodo: PeriodoResumo; treinos: number; km: number }) {
  const treinos = `${r.treinos} ${r.treinos === 1 ? "treino" : "treinos"}`;
  const km = r.km >= 1 ? ` e ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: r.km < 100 ? 1 : 0 }).format(r.km)} km` : "";
  const onde = r.periodo.id === "ano" ? "no ano" : r.periodo.id === "trimestre" ? "no trimestre" : "no mês";
  const ver = r.periodo.id === "ano" ? "a sua retrospectiva" : "o resumo";
  return {
    titulo: `${r.periodo.nomeNaFrase} fechou`.slice(0, 60),
    corpo: `${treinos}${km} ${onde}. Toque para ver ${ver} e compartilhar no status ou nos stories.`,
  };
}

/** Tamanho do título da imagem (1080 px): Barlow Condensed 800 em caixa alta ocupa ~0,46 em por letra; cabe em 920 px, até 230 px. */
export function tamanhoDoTitulo(titulo: string) {
  return Math.min(230, Math.floor(920 / (Math.max(1, titulo.length) * 0.46)));
}
