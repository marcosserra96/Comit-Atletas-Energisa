/**
 * Popula o Firebase Emulator (Auth + Firestore) com dados realistas para
 * testar os 3 perfis localmente, sem depender de um projeto Firebase real.
 *
 * Uso: npm run seed  (com os emuladores já rodando em outro terminal)
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const app = initializeApp({ projectId: "atletas-energisa-dev" });
const auth = getAuth(app);
const db = getFirestore(app);

const SENHA_PADRAO = "senha123";

async function criarUsuarioAuth(email: string, nome: string) {
  try {
    return await auth.createUser({ email, password: SENHA_PADRAO, displayName: nome });
  } catch {
    return auth.getUserByEmail(email);
  }
}

async function main() {
  console.log("Criando usuários no Auth Emulator…");
  const admin = await criarUsuarioAuth("admin@energisa.com.br", "Marcos Serra");
  const comite = await criarUsuarioAuth("comite@energisa.com.br", "Comitê Energisa");
  const ana = await criarUsuarioAuth("ana.corrida@energisa.com.br", "Ana Beatriz Lima");
  const bruno = await criarUsuarioAuth("bruno.bike@energisa.com.br", "Bruno Costa");
  const carla = await criarUsuarioAuth("carla.pendente@energisa.com.br", "Carla Pendente Souza");
  // Comitê que também compete de fato (equipe "bicicleta") — usado para testar o toggle "Minha Área" / "Modo Comitê".
  const paula = await criarUsuarioAuth("paula.comite.bike@energisa.com.br", "Paula Andrade");

  console.log("Gravando registros de atletas…");
  const now = Timestamp.now();

  const atletaAdmin = db.collection("atletas").doc("atleta-admin");
  const atletaComite = db.collection("atletas").doc("atleta-comite");
  const atletaAna = db.collection("atletas").doc("atleta-ana");
  const atletaBruno = db.collection("atletas").doc("atleta-bruno");
  const atletaDiego = db.collection("atletas").doc("atleta-diego"); // pré-cadastrado, sem login ainda
  const atletaPaula = db.collection("atletas").doc("atleta-paula");

  await atletaAdmin.set({
    id: "atleta-admin",
    nome: "Marcos Serra",
    email: "admin@energisa.com.br",
    role: "administrador",
    equipe: "comite",
    ativo: true,
    pontuacaoTotal: 0,
    authUid: admin.uid,
    criadoEm: now,
    atualizadoEm: now,
  });

  await atletaComite.set({
    id: "atleta-comite",
    nome: "Comitê Energisa",
    email: "comite@energisa.com.br",
    role: "comite",
    equipe: "comite",
    ativo: true,
    pontuacaoTotal: 0,
    authUid: comite.uid,
    criadoEm: now,
    atualizadoEm: now,
  });

  await atletaAna.set({
    id: "atleta-ana",
    nome: "Ana Beatriz Lima",
    email: "ana.corrida@energisa.com.br",
    role: "atleta",
    equipe: "corrida",
    ativo: true,
    pontuacaoTotal: 25,
    authUid: ana.uid,
    criadoEm: now,
    atualizadoEm: now,
  });

  await atletaBruno.set({
    id: "atleta-bruno",
    nome: "Bruno Costa",
    email: "bruno.bike@energisa.com.br",
    role: "atleta",
    equipe: "bicicleta",
    ativo: true,
    pontuacaoTotal: 5,
    authUid: bruno.uid,
    criadoEm: now,
    atualizadoEm: now,
  });

  // Atleta cadastrado manualmente pelo Comitê, ainda sem conta de login —
  // alvo do fluxo "vincular a atleta existente" na Aprovação de acessos.
  await atletaDiego.set({
    id: "atleta-diego",
    nome: "Diego Ferreira",
    email: null,
    role: null,
    equipe: "fila_corrida",
    ativo: false,
    ordemFila: 1,
    pontuacaoTotal: 0,
    authUid: null,
    criadoEm: now,
    atualizadoEm: now,
  });

  // Mais gente na fila de espera, pra testar reordenar por drag-and-drop.
  await db.collection("atletas").doc("atleta-elisa").set({
    id: "atleta-elisa",
    nome: "Elisa Rocha",
    email: null,
    role: null,
    equipe: "fila_corrida",
    ativo: false,
    ordemFila: 2,
    pontuacaoTotal: 0,
    authUid: null,
    criadoEm: now,
    atualizadoEm: now,
  });
  await db.collection("atletas").doc("atleta-felipe").set({
    id: "atleta-felipe",
    nome: "Felipe Souza",
    email: null,
    role: null,
    equipe: "fila_bicicleta",
    ativo: false,
    ordemFila: 1,
    pontuacaoTotal: 0,
    authUid: null,
    criadoEm: now,
    atualizadoEm: now,
  });
  await db.collection("atletas").doc("atleta-gabriela").set({
    id: "atleta-gabriela",
    nome: "Gabriela Nunes",
    email: null,
    role: null,
    equipe: "fila_bicicleta",
    ativo: false,
    ordemFila: 2,
    pontuacaoTotal: 0,
    authUid: null,
    criadoEm: now,
    atualizadoEm: now,
  });

  await atletaPaula.set({
    id: "atleta-paula",
    nome: "Paula Andrade",
    email: "paula.comite.bike@energisa.com.br",
    role: "comite",
    equipe: "bicicleta",
    ativo: true,
    pontuacaoTotal: 12,
    authUid: paula.uid,
    criadoEm: now,
    atualizadoEm: now,
  });

  console.log("Gravando ponteiros usuarios/{uid}…");
  await db.collection("usuarios").doc(admin.uid).set({
    uid: admin.uid,
    role: "administrador",
    atletaId: "atleta-admin",
    criadoEm: now,
  });
  await db.collection("usuarios").doc(comite.uid).set({
    uid: comite.uid,
    role: "comite",
    atletaId: "atleta-comite",
    criadoEm: now,
  });
  await db.collection("usuarios").doc(ana.uid).set({
    uid: ana.uid,
    role: "atleta",
    atletaId: "atleta-ana",
    criadoEm: now,
  });
  await db.collection("usuarios").doc(bruno.uid).set({
    uid: bruno.uid,
    role: "atleta",
    atletaId: "atleta-bruno",
    criadoEm: now,
  });
  await db.collection("usuarios").doc(paula.uid).set({
    uid: paula.uid,
    role: "comite",
    atletaId: "atleta-paula",
    criadoEm: now,
  });
  // Carla NÃO entra em "usuarios" — ela está pendente de aprovação.

  console.log("Gravando solicitação de acesso pendente (Carla)…");
  await db.collection("solicitacoes_acesso").doc(carla.uid).set({
    uid: carla.uid,
    nome: "Carla Pendente Souza",
    email: "carla.pendente@energisa.com.br",
    status: "pendente",
    criadoEm: now,
  });

  console.log("Gravando regras de pontuação…");
  const regraTreino = db.collection("regras_pontuacao").doc();
  const regraEvento = db.collection("regras_pontuacao").doc();
  const regraRecorde = db.collection("regras_pontuacao").doc();
  await regraTreino.set({
    id: regraTreino.id,
    descricao: "Participação em treino",
    modalidade: "ambas",
    pontos: 5,
    tiposLancamento: ["treino"],
    criadoEm: now,
  });
  await regraEvento.set({
    id: regraEvento.id,
    descricao: "Prova oficial concluída",
    modalidade: "ambas",
    pontos: 20,
    tiposLancamento: ["evento"],
    criadoEm: now,
  });
  await regraRecorde.set({
    id: regraRecorde.id,
    descricao: "Recorde pessoal",
    modalidade: "ambas",
    pontos: 10,
    tiposLancamento: ["evento", "avulso"],
    criadoEm: now,
  });

  console.log("Gravando histórico de pontos…");
  const lote1 = db.collection("historico_pontos").doc();
  await lote1.set({
    id: lote1.id,
    atletaId: "atleta-ana",
    atletaNome: "Ana Beatriz Lima",
    equipe: "corrida",
    regraId: regraTreino.id,
    regraDesc: "Participação em treino",
    pontos: 5,
    tipoLancamento: "treino",
    dataTreino: new Date().toISOString().slice(0, 10),
    loteId: "lote-seed-1",
    criadoPor: comite.uid,
    criadoPorNome: "Comitê Energisa",
    criadoEm: now,
    estornado: false,
  });
  const lote2 = db.collection("historico_pontos").doc();
  await lote2.set({
    id: lote2.id,
    atletaId: "atleta-ana",
    atletaNome: "Ana Beatriz Lima",
    equipe: "corrida",
    regraId: regraEvento.id,
    regraDesc: "Prova oficial concluída",
    pontos: 20,
    tipoLancamento: "evento",
    dataTreino: new Date().toISOString().slice(0, 10),
    loteId: "lote-seed-2",
    criadoPor: comite.uid,
    criadoPorNome: "Comitê Energisa",
    criadoEm: now,
    estornado: false,
  });
  const lote3 = db.collection("historico_pontos").doc();
  await lote3.set({
    id: lote3.id,
    atletaId: "atleta-bruno",
    atletaNome: "Bruno Costa",
    equipe: "bicicleta",
    regraId: regraTreino.id,
    regraDesc: "Participação em treino",
    pontos: 5,
    tipoLancamento: "treino",
    dataTreino: new Date().toISOString().slice(0, 10),
    loteId: "lote-seed-3",
    criadoPor: comite.uid,
    criadoPorNome: "Comitê Energisa",
    criadoEm: now,
    estornado: false,
  });

  console.log("Gravando agenda de eventos…");
  const dataFutura1 = new Date(Date.now() + 12 * 86400_000).toISOString().slice(0, 10);
  const dataFutura2 = new Date(Date.now() + 26 * 86400_000).toISOString().slice(0, 10);
  const evento1 = db.collection("agenda_eventos").doc();
  await evento1.set({
    id: evento1.id,
    titulo: "Circuito das Estações — Etapa 1",
    local: "Parque do Ibirapuera, São Paulo",
    modalidade: "corrida",
    data: dataFutura1,
    km: 10,
    criadoEm: now,
    criadoPor: comite.uid,
  });
  const evento2 = db.collection("agenda_eventos").doc();
  await evento2.set({
    id: evento2.id,
    titulo: "Desafio Serra Verde",
    local: "Serra da Cantareira, São Paulo",
    modalidade: "bicicleta",
    data: dataFutura2,
    km: 45,
    criadoEm: now,
    criadoPor: comite.uid,
  });

  console.log("Gravando notícias…");
  const noticia1 = db.collection("noticias").doc();
  await noticia1.set({
    id: noticia1.id,
    titulo: "Inscrições abertas para o Circuito das Estações",
    resumo: "Etapa 1 acontece em 12 dias. Garanta sua vaga na secretaria do comitê.",
    corpo: "Etapa 1 acontece em 12 dias. Garanta sua vaga na secretaria do comitê.",
    fixado: true,
    autorNome: "Comitê Energisa",
    autorUid: comite.uid,
    criadoEm: now,
  });
  const noticia2 = db.collection("noticias").doc();
  await noticia2.set({
    id: noticia2.id,
    titulo: "Novo regulamento de pontuação 2026",
    resumo: "Regras de pontuação por modalidade foram atualizadas para a nova temporada.",
    corpo: "Regras de pontuação por modalidade foram atualizadas para a nova temporada.",
    fixado: false,
    autorNome: "Comitê Energisa",
    autorUid: comite.uid,
    criadoEm: now,
  });

  console.log("Gravando despesas…");
  const despesa1 = db.collection("despesas").doc();
  await despesa1.set({
    id: despesa1.id,
    categoria: "Provas / Inscrições",
    equipe: "Corrida",
    evento: "Circuito das Estações — Etapa 1",
    avulso: false,
    propInsc: 1200,
    propTransp: 500,
    propHosp: 300,
    realInsc: 1200,
    realTransp: 400,
    realHosp: 200,
    totalProposto: 2000,
    totalRealizado: 1800,
    criadoEm: now,
  });

  console.log("\nSeed concluído. Contas de teste (senha: " + SENHA_PADRAO + "):");
  console.log("  administrador -> admin@energisa.com.br");
  console.log("  comite        -> comite@energisa.com.br");
  console.log("  atleta (ana)  -> ana.corrida@energisa.com.br");
  console.log("  atleta (bruno)-> bruno.bike@energisa.com.br");
  console.log("  comitê+atleta -> paula.comite.bike@energisa.com.br (também compete de bike)");
  console.log("  pendente      -> carla.pendente@energisa.com.br (aguardando aprovação)");
  console.log("  sem login     -> atleta-diego (cadastrado pelo comitê, pronto para vínculo)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
