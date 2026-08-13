import { renderToFile } from "@react-pdf/renderer";
import { InformativoRankingDocument } from "./src/lib/pdf/InformativoRankingDocument";
import { LAYOUT_INFORMATIVO_PADRAO } from "./src/lib/informativoLayout";
import type { ResumoAtletaMensal } from "./src/lib/rankingMensal";

const nomes = [
  "Weslei Louzado Diana", "Wagner Luis Porfirio Rezende", "Erique Rangel Fortes",
  "Ana Carolina Nogueira Lima", "Roberto Werneck", "Eliseu Luiz dos Santos Firmino",
  "Marx Teixeira", "Paula Mara de Oliveira Rios", "Dayvison Moreira Teixeira",
  "Caroline Bernardes de Castro", "Maria Julia Nogueira Lima", "Fabiane Barbosa",
  "Marco Aurelio Vilela", "Pollyana Cerqueira Soares", "Rafaela Gonçalves",
  "Hugo Alves de Oliveira", "Aline Borges Carneiro", "Larissa Freire",
  "Camila do Carmo Lelis", "Lauany Peixoto Duarte", "Rodrigo Sales de Lima",
  "Amanda de Almeida Carlos Oliveira", "Matheus Marchiote", "Debora Santos",
  "Livia Souza Aguiar", "Micheli de Almeida Bernardes", "Maria Eduarda Gomes de Souza",
  "Jaqueline Zenobio", "Acrisio Rafael Maximiano Mendonça", "Paloma Bernardes",
  "Bruno Alves", "Marileia Santos da Costa Silva", "Gabriel Dias Eduardo Martins",
  "Luciano José Silva e Cunha", "Viviane Muniz Evangelista", "Ronald Freitas Magalhaes",
  "Edgar Belina", "Ingrid Portela Venturini Torres", "Extra Um", "Extra Dois", "Extra Tres",
];

const corrida: ResumoAtletaMensal[] = nomes.map((nome, i) => ({
  id: `c${i}`,
  nome,
  equipe: "corrida",
  pontosMes: Math.max(0, 26 - Math.round(i * 0.6) + (i % 3)),
  treinosMes: Math.max(0, 15 - Math.round(i * 0.35)),
  kmMes: Math.max(0, 135 - i * 3.2),
  ultimaData: "2026-06-28",
}));

const base = "/private/tmp/claude-501/-Users-marcos-Desktop-Atletas/c6d35eb5-3033-4c0d-a3be-4d1ba2168556/scratchpad";

async function gerar(ocultarTop3: boolean, arquivo: string) {
  await renderToFile(
    <InformativoRankingDocument
      bike={[]}
      corrida={corrida}
      mesLabel="Junho a Agosto de 2026"
      modalidadeFiltro="corrida"
      limite={100}
      fundoCorrida="/Users/marcos/Desktop/Atletas/atletas-energisa-portal/public/informativo-fundo-corrida.png"
      fundoBike="/Users/marcos/Desktop/Atletas/atletas-energisa-portal/public/informativo-fundo-bike.png"
      layout={LAYOUT_INFORMATIVO_PADRAO}
      ocultarTop3={ocultarTop3}
    />,
    `${base}/${arquivo}`,
  );
  console.log("gerado:", arquivo);
}

async function main() {
  await gerar(false, "info-normal.pdf");
  await gerar(true, "info-sem-top3.pdf");
}

main();
