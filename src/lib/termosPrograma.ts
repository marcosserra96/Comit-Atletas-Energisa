import type {
  DocumentoProgramaDoc,
  DocumentoProgramaId,
  Equipe,
  Modalidade,
  TipoDocumentoPrograma,
} from "@/lib/types";

export const DOCUMENTO_PROGRAMA_IDS: DocumentoProgramaId[] = [
  "corrida_regulamento",
  "corrida_termo_responsabilidade",
  "bicicleta_regulamento",
  "bicicleta_termo_responsabilidade",
];

export const DOCUMENTOS_POR_MODALIDADE: Record<Modalidade, DocumentoProgramaId[]> = {
  corrida: ["corrida_regulamento", "corrida_termo_responsabilidade"],
  bicicleta: ["bicicleta_regulamento", "bicicleta_termo_responsabilidade"],
};

const REGULAMENTO_CORRIDA = `1. Para fazer parte do programa Atletas Energisa, receber o uniforme, treinar e participar dos eventos o participante/colaborador/atleta deve:

   a. Ser funcionário de uma das empresas do grupo Energisa.
   b. Ter disponibilidade de horário para treinar e participar dos eventos, conforme agenda prévia.
   c. Cumprir todos os itens do regulamento abaixo;
   d. Estar treinando no mínimo há 60 dias com a equipe;
   e. Estar correndo no mínimo 2 vezes por semana, com percurso de 5Km ou superior;
   f. É obrigatório o uso de tênis apropriado para corrida.

2. Uma vez recebido o uniforme do Programa Atletas Energisa é obrigatório o uso dele nos treinos, eventos e treinos extras oficiais do programa.

3. O participante/colaborador/atleta deverá formalizar e registrar todos os treinos através do aplicativo escolhido em comum acordo com o treinador (Strava);

4. O participante/colaborador/atleta lotado em Cataguases/MG, dos 2 (dois) treinos semanais, deve comparecer, no mínimo, a 1 (um) treino presencial com o treinador no intervalo máximo de 07 (sete) dias corridos. Para os colaboradores não lotados em Cataguases/MG, os treinos deverão ser mantidos em sua localidade conforme regulamento.

5. Em caso de participação em passeios, provas, eventos e outros, a concentração se dará em Cataguases/MG. Devendo o participante custear as despesas com deslocamento até Cataguases/MG, salvo deliberalidades a serem avaliadas pelo comitê do programa Atletas Energisa.

6. Quando, por qualquer motivo, o participante do programa não puder comparecer aos treinos conforme regulamento, deverá justificar a ausência e cumprir o treino em horário e dia alternativo dentro da mesma semana, salvo alguma restrição médica ou justificável, a ser avaliada pela comissão do programa. As justificativas serão avaliadas previamente pelo comitê.

7. A inclusão de novos atletas na equipe ocorrerá conforme a disponibilidade de vagas e seguindo os critérios do regulamento.

8. Caso o participante/colaborador/atleta não se enquadre no regulamento será desligado do Programa Atletas Energisa e deve devolver o uniforme e outros materiais que a empresa possa ter fornecido.

Li, compreendi, aceito e me submeto integralmente a todos os termos do regulamento do Programa de Corrida Atletas Energisa e estou ciente da possível desclassificação que posso sofrer caso descumpra o regulamento.

Por fim, declaro estar ciente que o programa Atletas Energisa é voluntário, e a participação das atividades semanais, possíveis eventos e provas, não devem ser confundidos com a prestação de serviços, tampouco considerados como jornada de trabalho, possuindo o colaborador pela liberdade e adesão;`;

const REGULAMENTO_BICICLETA = `1. Para fazer parte do programa Atletas Energisa, receber o uniforme, treinar e participar dos eventos o participante/colaborador/atleta deve:

   a. Ser funcionário de uma das empresas do grupo Energisa.
   b. Ter disponibilidade de horário para treinar e participar dos eventos, conforme agenda prévia.
   c. Cumprir todos os itens do regulamento abaixo;
   d. Estar treinando no mínimo há 60 dias com a equipe;
   e. Estar pedalando no mínimo 2 vezes por semana, com percurso de 30Km e média igual ou superior a 16k/h no trajeto do Marotinho;
   f. A bicicleta deve ter configurações mínimas que garantam que o participante/colaborador/atleta possa acompanhar os treinos com qualidade e segurança. Tais configurações são pelo menos uma bicicleta aro 29, com quadro adequado ao tamanho do participante/colaborador/atleta e com configurações mínimas de 29 e 24 marchas com Catraca Megaranger.
   g. É obrigatório o uso dos itens de segurança nos treinos, passeios, provas como: capacete ciclista, luvas, óculos, sapatilhas ou tênis e luzes de sinalização.

2. Uma vez recebido o uniforme do Programa Atletas Energisa é obrigatório o uso dele nos treinos, eventos e treinos extras oficiais do programa.

3. O participante/colaborador/atleta deverá formalizar e registrar todos os treinos através do aplicativo escolhido em comum acordo com o treinador (Strava);

4. O participante/colaborador/atleta lotado em Cataguases/MG, dos 2 (dois) treinos semanais, deve comparecer, no mínimo, a 1 (um) treino presencial com o treinador no intervalo máximo de 07 (sete) dias. Para os colaboradores não lotados em Cataguases/MG, os treinos deverão ser mantidos em sua localidade conforme regulamento.

5. Em caso de participação em passeios, provas, eventos e outros, a concentração se dará em Cataguases/MG. Devendo o participante custear as despesas com deslocamento até Cataguases/MG, salvo deliberalidades a serem avaliadas pelo comitê do programa Atletas Energisa.

6. Quando, por qualquer motivo, o participante do programa não puder comparecer aos treinos conforme regulamento, deverá justificar a ausência e cumprir o treino em horário e dia alternativo dentro da mesma semana, salvo alguma restrição médica ou justificável, a ser avaliada pela comissão do programa. As justificativas serão avaliadas previamente pelo comitê.

7. A inclusão de novos atletas na equipe ocorrerá conforme a disponibilidade de vagas e seguindo os critérios do regulamento.

8. Caso o participante/colaborador/atleta não se enquadre no regulamento será desligado do Programa Atletas Energisa e deve devolver o uniforme e outros materiais que a empresa possa ter fornecido.

Li, compreendi, aceito e me submeto integralmente a todos os termos do regulamento do Programa de Bike Atletas Energisa e estou ciente da possível desclassificação que posso sofrer caso descumpra o regulamento.

Por fim, declaro estar ciente que o programa Atletas Energisa é voluntário, e a participação das atividades semanais, possíveis eventos e provas, não devem ser confundidos com a prestação de serviços, tampouco considerados como jornada de trabalho, possuindo o colaborador pela liberdade e adesão;`;

const TERMO_CORRIDA = `1. Estou ciente que o Atletas Energisa se trata de um programa voluntário, e a participação das atividades semanais, eventos e provas não devem ser confundidos com a prestação de serviços, tampouco considerados como jornada de trabalho, possuindo o colaborador pela liberdade e adesão;

2. Também estou ciente de que serei treinado para estar apto a participar de treinos, eventos e provas na modalidade corrida;

3. Declaro, que estou em plenas condições físicas e psicológicas de participar deste treinamento, e que não possuo nenhuma recomendação/ restrição médica que me impeça de praticar atividades físicas;

4. Assumo, por minha livre e espontânea vontade, todos os riscos envolvidos e suas consequências pela participação neste Programa, isentando a empresa, organizadores e colaboradores DE TODA E QUALQUER RESPONSABILIDADE por quaisquer danos materiais, morais ou físicos, que porventura venha a sofrer, advindos da participação no Programa Atletas Energisa;

5. Estou ciente de que consultas e exames médicos eventualmente necessários, serão realizados por meio do plano de saúde já oferecido pela empresa ou às minhas expensas;

6. Autorizo o uso de minha imagem para fins de divulgação do Programa, por fotos, vídeos e entrevistas em qualquer meio de comunicação, sem geração de ônus para a Energisa;

Li, compreendi, aceito e me submeto integralmente a todos os termos acima.`;

const TERMO_BICICLETA = `1. Estou ciente que o Atletas Energisa se trata de um programa voluntário, e a participação das atividades semanais, eventos e provas não devem ser confundidos com a prestação de serviços, tampouco considerados como jornada de trabalho, possuindo o colaborador pela liberdade e adesão;

2. Também estou ciente de que serei treinado para estar apto a participar de treinos, eventos e provas na modalidade Bike;

3. Declaro, que estou em plenas condições físicas e psicológicas de participar deste treinamento, e que não possuo nenhuma recomendação/ restrição médica que me impeça de praticar atividades físicas;

4. Assumo, por minha livre e espontânea vontade, todos os riscos envolvidos e suas consequências pela participação neste Programa, isentando a empresa, organizadores e colaboradores DE TODA E QUALQUER RESPONSABILIDADE por quaisquer danos materiais, morais ou físicos, que porventura venha a sofrer, advindos da participação no Programa Atletas Energisa;

5. Estou ciente de que consultas e exames médicos eventualmente necessários, serão realizados por meio do plano de saúde já oferecido pela empresa ou às minhas expensas;

6. Autorizo o uso de minha imagem para fins de divulgação do Programa, por fotos, vídeos e entrevistas em qualquer meio de comunicação, sem geração de ônus para a Energisa;

Li, compreendi, aceito e me submeto integralmente a todos os termos acima.`;

export const DOCUMENTOS_PROGRAMA_PADRAO: Record<DocumentoProgramaId, DocumentoProgramaDoc> = {
  corrida_regulamento: {
    id: "corrida_regulamento",
    modalidade: "corrida",
    tipo: "regulamento",
    titulo: "Regulamento do Programa Atletas Energisa — Corrida",
    conteudo: REGULAMENTO_CORRIDA,
    ativo: true,
    versao: 1,
  },
  corrida_termo_responsabilidade: {
    id: "corrida_termo_responsabilidade",
    modalidade: "corrida",
    tipo: "termo_responsabilidade",
    titulo: "Termo de Responsabilidade — Corrida",
    conteudo: TERMO_CORRIDA,
    ativo: true,
    versao: 1,
  },
  bicicleta_regulamento: {
    id: "bicicleta_regulamento",
    modalidade: "bicicleta",
    tipo: "regulamento",
    titulo: "Regulamento do Programa Atletas Energisa — Bike",
    conteudo: REGULAMENTO_BICICLETA,
    ativo: true,
    versao: 2,
  },
  bicicleta_termo_responsabilidade: {
    id: "bicicleta_termo_responsabilidade",
    modalidade: "bicicleta",
    tipo: "termo_responsabilidade",
    titulo: "Termo de Responsabilidade — Bike",
    conteudo: TERMO_BICICLETA,
    ativo: true,
    versao: 2,
  },
};

export function documentoProgramaValido(value: unknown): value is DocumentoProgramaId {
  return typeof value === "string" && DOCUMENTO_PROGRAMA_IDS.includes(value as DocumentoProgramaId);
}

export function modalidadeDocumentoDaEquipe(equipe: Equipe | string): Modalidade | null {
  if (equipe === "corrida" || equipe === "fila_corrida") return "corrida";
  if (equipe === "bicicleta" || equipe === "fila_bicicleta") return "bicicleta";
  return null;
}

export function configDocumentoProgramaId(id: DocumentoProgramaId) {
  return `documento_programa_${id}`;
}

export function aceiteDocumentoProgramaId(uid: string, documentoId: DocumentoProgramaId) {
  return `${uid}__${documentoId}`;
}

export function documentoProgramaComFallback(
  id: DocumentoProgramaId,
  data?: Partial<DocumentoProgramaDoc>,
): DocumentoProgramaDoc {
  const padrao = DOCUMENTOS_PROGRAMA_PADRAO[id];
  const tituloOriginal =
    typeof data?.titulo === "string" && data.titulo.trim() ? data.titulo : padrao.titulo;
  const conteudoOriginal =
    typeof data?.conteudo === "string" && data.conteudo.trim()
      ? data.conteudo
      : padrao.conteudo;
  const documentoBike = padrao.modalidade === "bicicleta";
  const normalizarBike = (texto: string) =>
    documentoBike
      ? texto
          .replace(/modalidade bicicleta \(mountain biking\)/gi, "modalidade Bike")
          .replace(/Montain Bike/gi, "Bike")
          .replace(/Mountain Bike/gi, "Bike")
      : texto;
  const titulo = normalizarBike(tituloOriginal);
  const conteudo = normalizarBike(conteudoOriginal);
  const versaoInformada = Number(data?.versao) || padrao.versao;
  const textoLegadoNormalizado = titulo !== tituloOriginal || conteudo !== conteudoOriginal;

  return {
    ...padrao,
    ...data,
    id,
    modalidade: padrao.modalidade,
    tipo: padrao.tipo,
    titulo,
    conteudo,
    ativo: typeof data?.ativo === "boolean" ? data.ativo : padrao.ativo,
    versao: Math.max(
      padrao.versao,
      textoLegadoNormalizado ? versaoInformada + 1 : versaoInformada,
    ),
  };
}

export function documentosPadraoDaModalidade(modalidade: Modalidade) {
  return DOCUMENTOS_POR_MODALIDADE[modalidade].map((id) => DOCUMENTOS_PROGRAMA_PADRAO[id]);
}

export function tipoDocumentoLabel(tipo: TipoDocumentoPrograma) {
  return tipo === "regulamento" ? "Regulamento" : "Termo de responsabilidade";
}

export function modalidadeDocumentoLabel(modalidade: Modalidade) {
  return modalidade === "corrida" ? "Corrida" : "Bike";
}
