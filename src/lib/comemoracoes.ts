import type { AtletaDoc } from "@/lib/types";
import { modalidadeFromEquipe, isWaitlisted } from "@/lib/labels";

/**
 * Datas para comemorar na página inicial do atleta: o aniversário e o
 * aniversário de entrada na equipe. Aparecem no dia e, para quem não abriu o
 * portal no fim de semana, até dois dias depois ("parabéns atrasado").
 */
export type TipoComemoracao = "aniversario" | "programa";

export interface Comemoracao {
  tipo: TipoComemoracao;
  /** 0 = hoje, 1 = ontem, 2 = anteontem. */
  diasDepois: number;
  /** Só no aniversário de entrada: anos completos na equipe. */
  anos?: number;
  /** Dia em que caiu, YYYY-MM-DD. */
  data: string;
}

const DIAS_DE_TOLERANCIA = 2;

function ehBissexto(ano: number) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** Em que dia do ano informado cai o aniversário de MM-DD (29/02 vira 28/02 nos anos comuns). */
function diaNoAno(mmdd: string, ano: number) {
  if (mmdd === "02-29" && !ehBissexto(ano)) return `${ano}-02-28`;
  return `${ano}-${mmdd}`;
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Se o aniversário de `origem` caiu entre hoje e dois dias atrás, devolve o dia e a distância. */
function ocorrenciaRecente(origem: string, hoje: string) {
  const ano = Number(hoje.slice(0, 4));
  // Olha o ano corrente e o anterior, para "parabéns atrasado" na virada do ano.
  for (const a of [ano, ano - 1]) {
    const data = diaNoAno(origem.slice(5), a);
    const dias = diasEntre(data, hoje);
    if (dias >= 0 && dias <= DIAS_DE_TOLERANCIA) return { data, dias };
  }
  return null;
}

export function comemoracoesDoAtleta(atleta: Pick<AtletaDoc, "dataNascimento" | "entrouNaEquipeEm" | "equipe">, hoje: string): Comemoracao[] {
  const lista: Comemoracao[] = [];
  if (atleta.dataNascimento && DATA.test(atleta.dataNascimento)) {
    const r = ocorrenciaRecente(atleta.dataNascimento, hoje);
    if (r) lista.push({ tipo: "aniversario", diasDepois: r.dias, data: r.data });
  }
  // O aniversário de equipe só vale para quem está numa equipe (não na fila).
  if (atleta.entrouNaEquipeEm && DATA.test(atleta.entrouNaEquipeEm) && modalidadeFromEquipe(atleta.equipe) && !isWaitlisted(atleta.equipe)) {
    const r = ocorrenciaRecente(atleta.entrouNaEquipeEm, hoje);
    const anos = r ? Number(r.data.slice(0, 4)) - Number(atleta.entrouNaEquipeEm.slice(0, 4)) : 0;
    if (r && anos >= 1) lista.push({ tipo: "programa", diasDepois: r.dias, anos, data: r.data });
  }
  return lista;
}

/** Anos completos no programa, pelo ano de entrada (o que a maioria dos cadastros tem). */
export function anosNoPrograma(atleta: Pick<AtletaDoc, "anoEntrada" | "entrouNaEquipeEm">, hoje: string) {
  const ano = atleta.anoEntrada || (atleta.entrouNaEquipeEm ? Number(atleta.entrouNaEquipeEm.slice(0, 4)) : 0);
  const anos = ano ? Number(hoje.slice(0, 4)) - ano : 0;
  return anos >= 1 ? anos : 0;
}

const DIA_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function quando(c: Comemoracao) {
  if (c.diasDepois === 1) return "ontem";
  const dia = new Date(`${c.data}T12:00:00Z`).getUTCDay();
  return dia === 0 || dia === 6 ? `no ${DIA_DA_SEMANA[dia]}` : `na ${DIA_DA_SEMANA[dia]}`;
}

const anosTexto = (n: number) => (n === 1 ? "1 ano" : `${n} anos`);

export interface MensagemComemoracao {
  titulo: string;
  texto: string;
}

/**
 * O texto do cartão. Quando as duas datas caem juntas, vira uma mensagem só.
 * Fala de treino na modalidade da pessoa (quilômetros na corrida, pedaladas na bike).
 */
export function mensagemDaComemoracao(params: {
  comemoracoes: Comemoracao[];
  nome: string;
  equipe: AtletaDoc["equipe"];
  /** Anos no programa pelo ano de entrada, para lembrar no aniversário (0 = não informa). */
  anosNoPrograma: number;
}): MensagemComemoracao | null {
  const { comemoracoes, nome, anosNoPrograma: anosPrograma } = params;
  const primeiro = nome.trim().split(/\s+/)[0] || nome;
  const modalidade = modalidadeFromEquipe(params.equipe);
  const treino = modalidade === "bicicleta" ? "boas pedaladas" : modalidade === "corrida" ? "bons quilômetros" : "bons treinos";
  const niver = comemoracoes.find((c) => c.tipo === "aniversario");
  const programa = comemoracoes.find((c) => c.tipo === "programa");
  if (!niver && !programa) return null;
  const nomeEquipe = modalidade === "bicicleta" ? "Bike" : "Corrida";

  if (niver && programa && niver.diasDepois === programa.diasDepois) {
    return {
      titulo: niver.diasDepois === 0 ? `Dia duplo de festa, ${primeiro}!` : `Parabéns atrasado em dobro, ${primeiro}!`,
      texto: `${niver.diasDepois === 0 ? "Hoje é seu aniversário e também faz" : `${quando(niver)[0].toUpperCase()}${quando(niver).slice(1)} foi seu aniversário e também fez`} ${anosTexto(programa.anos!)} que você entrou na equipe de ${nomeEquipe}. Feliz aniversário, e obrigado por fazer parte do Atletas Energisa. Que venham muitos ${treino} pela frente!`,
    };
  }

  if (niver) {
    const lembrete = anosPrograma ? ` Obrigado por esses ${anosTexto(anosPrograma)} de programa com a gente.` : "";
    if (niver.diasDepois === 0) {
      return {
        titulo: `Feliz aniversário, ${primeiro}!`,
        texto: `Hoje o dia é seu. Todo o time do Atletas Energisa deseja um novo ano com saúde, ${treino} e muitas conquistas.${lembrete}`,
      };
    }
    return {
      titulo: `Parabéns atrasado, ${primeiro}!`,
      texto: `Seu aniversário foi ${quando(niver)}, e o time do Atletas Energisa deseja um novo ano com saúde, ${treino} e muitas conquistas.${lembrete}`,
    };
  }

  const p = programa!;
  return {
    titulo: `${anosTexto(p.anos!)} de Atletas Energisa!`,
    texto: `${p.diasDepois === 0 ? "Hoje faz" : `${quando(p)[0].toUpperCase()}${quando(p).slice(1)} fez`} ${anosTexto(p.anos!)} que você entrou na equipe de ${nomeEquipe}, ${primeiro}. Obrigado por cada treino e por fazer o programa crescer. Que venham muitos ${treino}!`,
  };
}
