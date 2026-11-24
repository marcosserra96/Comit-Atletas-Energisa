import { executarAnalise, MEDIDAS, type DadosAnalise } from "@/lib/analises/motor";
import { textoDoValor, type MedidaDoPremio, type PremioPersonalizado, type ResultadoPremio } from "@/lib/premiacaoPersonalizada";
import { equipeLabel } from "@/lib/labels";
import { idDoAtleta } from "@/lib/modalidade";

/**
 * Certificados: uma página por atleta, em A4 deitado. Quem recebe vem de uma
 * premiação com critérios, de uma meta atingida ou da escolha do comitê; os
 * textos têm campos ({nome}, {colocacao}…) preenchidos para cada pessoa.
 */

export type LayoutCertificado = "classico" | "podio" | "marca" | "imagem";
export type OrigemCertificado = "premio" | "meta" | "manual";

/** A4 deitado a 150 dpi: nítido na impressão e leve para gerar no navegador. */
export const TAMANHO_CERTIFICADO = { largura: 1754, altura: 1240 } as const;

export const LAYOUTS_CERTIFICADO: { id: LayoutCertificado; nome: string; descricao: string }[] = [
  { id: "classico", nome: "Clássico", descricao: "Papel claro, moldura e selo dourado" },
  { id: "podio", nome: "Pódio", descricao: "Azul-escuro e dourado, para premiações" },
  { id: "marca", nome: "Marca", descricao: "A arte dos atletas e as curvas do programa" },
  { id: "imagem", nome: "Sua arte", descricao: "Uma imagem de fundo do seu computador" },
];

export interface TextosCertificado {
  titulo: string;
  subtitulo: string;
  abertura: string;
  texto: string;
  data: string;
  assinatura1: string;
  cargo1: string;
  assinatura2: string;
  cargo2: string;
}

export interface Destinatario {
  id: string;
  nome: string;
  equipe?: "corrida" | "bicicleta";
  /** 1, 2, 3… quando vem de uma premiação. */
  colocacao?: number;
  /** Os números que justificam ("1.240 pontos", "14,2 treinos/mês"). */
  valores: string[];
}

/** Campos que o comitê pode usar no texto. */
export const CAMPOS_DO_TEXTO: { chave: string; descricao: string }[] = [
  { chave: "{nome}", descricao: "Nome do atleta" },
  { chave: "{colocacao}", descricao: "1º lugar, 2º lugar…" },
  { chave: "{premio}", descricao: "Nome do prêmio" },
  { chave: "{periodo}", descricao: "Período, já com a preposição: em 2026, no 3º trimestre 2026" },
  { chave: "{valores}", descricao: "Os números do atleta" },
  { chave: "{equipe}", descricao: "Corrida ou Bike" },
];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11-19" → "Novembro de 2026". */
export function dataDoCertificado(hoje: string) {
  const m = MESES[Number(hoje.slice(5, 7)) - 1] ?? "";
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${hoje.slice(0, 4)}`;
}

export function textosPadrao(origem: OrigemCertificado, hoje: string): TextosCertificado {
  const comum = { abertura: "Certificamos que", data: dataDoCertificado(hoje), assinatura1: "Comitê Atletas Energisa", cargo1: "Programa Atletas Energisa", assinatura2: "", cargo2: "" };
  if (origem === "premio") {
    return { ...comum, titulo: "Certificado", subtitulo: "de premiação", texto: "conquistou o *{colocacao}* no prêmio *{premio}* {periodo}, com {valores}." };
  }
  if (origem === "meta") {
    return { ...comum, titulo: "Certificado", subtitulo: "de reconhecimento", texto: "alcançou *{valores}* {periodo}, um exemplo de dedicação e constância no programa Atletas Energisa." };
  }
  return { ...comum, titulo: "Certificado", subtitulo: "de participação", texto: "fez parte do programa *Atletas Energisa* {periodo}, levando movimento e energia para o nosso time." };
}

/** O período dentro da frase: "em 2026" (ano) ou "no 3º trimestre 2026". */
export function periodoNaFrase(p: { nome: string; anual: boolean; ano: string }) {
  if (p.anual) return `em ${p.ano}`;
  const nome = p.nome.includes(p.ano) ? p.nome : `${p.nome} de ${p.ano}`;
  return `no ${nome.charAt(0).toLowerCase()}${nome.slice(1)}`;
}

/** "1º lugar". */
export const textoColocacao = (n?: number) => (n ? `${n}º lugar` : "");

/** Junta os números: "1.240 pontos e 14,2 treinos/mês"; "a, b e c". */
export function juntarValores(valores: readonly string[]) {
  if (valores.length <= 1) return valores[0] ?? "";
  return `${valores.slice(0, -1).join(", ")} e ${valores[valores.length - 1]}`;
}

/** Troca os campos pelo que é da pessoa. Campo sem valor some (sem deixar "{premio}" no papel). */
export function preencher(texto: string, d: Destinatario, ctx: { premio: string; periodo: string }) {
  const valores: Record<string, string> = {
    "{nome}": d.nome,
    "{colocacao}": textoColocacao(d.colocacao),
    "{premio}": ctx.premio,
    "{periodo}": ctx.periodo,
    "{valores}": juntarValores(d.valores),
    "{equipe}": d.equipe ? equipeLabel[d.equipe] : "",
  };
  return texto.replace(/\{(nome|colocacao|premio|periodo|valores|equipe)\}/g, (m) => valores[m] ?? "");
}

/** Quem vai ao pódio de uma premiação com critérios (todos os grupos, na ordem). */
export function destinatariosDoPremio(premio: PremioPersonalizado, resultado: ResultadoPremio): Destinatario[] {
  return resultado.grupos.flatMap((g) =>
    g.classificacao.slice(0, premio.quantidade).map((c) => ({
      id: `${g.equipe}-${c.id}`,
      nome: c.nome,
      equipe: c.equipe,
      colocacao: c.posicao,
      valores: premio.criterios.map((cr, i) => textoDoValor(cr, c.valores[i])),
    })),
  );
}

export interface MetaCertificado {
  medida: MedidaDoPremio;
  minimo: number;
  equipe: "todas" | "corrida" | "bicicleta";
}

/** Todos que chegaram ao mínimo da meta no período, do maior para o menor. */
export function destinatariosDaMeta(meta: MetaCertificado, dados: DadosAnalise, periodo: { inicio: string; fim: string }): Destinatario[] {
  const r = executarAnalise(
    {
      medida: meta.medida,
      linhas: "atleta",
      colunas: null,
      periodo: { de: periodo.inicio, ate: periodo.fim },
      anterior: null,
      equipe: meta.equipe,
      criterios: [],
      tipos: [],
      sexo: "todos",
      somenteAtivos: true,
      modo: "total",
      minimo: Math.max(meta.minimo, Number.MIN_VALUE),
      top: null,
    },
    dados,
  );
  const porId = new Map(dados.atletas.map((a) => [a.id, a]));
  return r.linhas.map((l) => {
    const a = porId.get(idDoAtleta(l.chave));
    return {
      id: l.chave,
      nome: l.rotulo,
      equipe: meta.equipe !== "todas" ? meta.equipe : a?.equipe === "bicicleta" ? "bicicleta" : "corrida",
      valores: [textoDoValor({ medida: meta.medida, exibir: "total" }, l.valor ?? 0)],
    };
  });
}

/** Rótulo da meta para a tela: "Treinos ≥ 48". */
export const rotuloDaMeta = (meta: MetaCertificado) => `${MEDIDAS[meta.medida].rotulo} a partir de ${meta.minimo}`;

/** "certificado-mariana-souza.png" / "certificados-atleta-do-ano.pdf". */
export function nomeDoArquivoCertificado(base: string, extensao: "png" | "pdf", varios = false) {
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${varios ? "certificados" : "certificado"}-${limpo || "atletas"}.${extensao}`;
}
