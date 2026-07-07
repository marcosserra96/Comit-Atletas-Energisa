/**
 * Popula um Firebase Emulator ISOLADO (portas 8081/9098) com dados fake para
 * o app LEGADO (zip), só para capturar telas de referência visual.
 * Nunca aponta para o projeto real "inovacao-emr".
 *
 * Uso: npx tsx scripts/seed-legacy.ts (com o emulador legado já rodando)
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9098";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const app = initializeApp({ projectId: "legacy-demo-local" });
const auth = getAuth(app);
const db = getFirestore(app);

const SENHA = "senha123";

const nomes = [
  "Acrisio Rafael Maximiano Mendonça", "Amanda Almeida", "Ana Carolina Nogueira Lima",
  "Ana Carolina Souza Almeida", "Andrehon Aparecido da Costa Tacon", "Bruno Henrique Silva",
  "Camila Ferreira Santos", "Carlos Eduardo Rocha", "Daniela Martins Costa",
  "Eduardo Pereira Alves", "Fernanda Lima Souza", "Gabriel Oliveira Cardoso",
  "Isabela Cristina Ramos", "João Victor Barbosa", "Larissa Gomes Teixeira",
  "Lucas Mendes Carvalho", "Mariana Duarte Pinto", "Paulo Roberto Nascimento",
  "Rafaela Correia Batista", "Thiago Augusto Freitas",
];

async function criarUsuario(email: string, nome: string) {
  try {
    return await auth.createUser({ email, password: SENHA, displayName: nome });
  } catch {
    return auth.getUserByEmail(email);
  }
}

function slug(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function main() {
  console.log("Criando admin de demonstração…");
  const admin = await criarUsuario("admin@demo.local", "Marcos Serra");
  const now = Timestamp.now();

  await db.collection("atletas").doc(admin.uid).set({
    nome: "Marcos Serra",
    email: "admin@demo.local",
    role: "admin",
    status: "Aprovado",
    equipe: "Comitê",
    ativo: true,
    pontuacaoTotal: 0,
    permissoes: [],
    criadoEm: now,
    atualizadoEm: now,
  });

  console.log("Criando atletas de demonstração…");
  const equipes = ["Bicicleta", "Corrida"];
  for (let i = 0; i < nomes.length; i++) {
    const nome = nomes[i];
    const email = `${slug(nome)}@energisa.com.br`;
    const equipe = equipes[i % 2];
    const pontos = Math.floor(Math.random() * 200);
    const km = Math.round(Math.random() * 300);

    const atletaRef = db.collection("atletas").doc();
    await atletaRef.set({
      nome,
      email,
      role: "atleta",
      status: "Aprovado",
      equipe,
      ativo: true,
      pontuacaoTotal: pontos,
      sexo: i % 3 === 0 ? "Feminino" : "Masculino",
      localidade: i % 2 === 0 ? "Sede" : "João Pessoa",
      anoEntrada: 2023 + (i % 3),
      recusas: 0,
      criadoEm: now,
      atualizadoEm: now,
    });

    // histórico de pontos (para alimentar KM total / pontos / eventos)
    if (km > 0) {
      await db.collection("historico_pontos").add({
        atletaId: atletaRef.id,
        atletaNome: nome,
        atletaEquipe: equipe,
        regraId: "seed-regra",
        regraDesc: "Participação em treino",
        pontos: 5,
        descTreino: "Treino de sábado",
        dataTreino: new Date().toISOString().slice(0, 10),
        kmPercorrido: km,
        loteId: `lote-seed-${i}`,
        tipoLancamento: "treino",
        criadoPor: admin.uid,
        criadoPorNome: "Marcos Serra",
        criadoEm: now,
        estornado: false,
      });
    }
  }

  console.log("Gravando regras de pontuação…");
  await db.collection("regras_pontuacao").add({
    descricao: "Participação em treino",
    modalidade: "Ambas",
    pontos: 5,
    tiposLancamento: ["treino"],
    criadoEm: now,
  });
  await db.collection("regras_pontuacao").add({
    descricao: "Prova oficial concluída",
    modalidade: "Ambas",
    pontos: 20,
    tiposLancamento: ["evento"],
    criadoEm: now,
  });

  console.log("Gravando agenda de eventos…");
  await db.collection("agenda_eventos").add({
    titulo: "Circuito das Estações — Etapa 1",
    local: "Parque do Ibirapuera, São Paulo",
    modalidade: "Corrida",
    data: new Date(Date.now() + 12 * 86400_000).toISOString().slice(0, 10),
    km: 10,
    criadoEm: now,
  });
  await db.collection("agenda_eventos").add({
    titulo: "Desafio Serra Verde",
    local: "Serra da Cantareira, São Paulo",
    modalidade: "Bicicleta",
    data: new Date(Date.now() + 26 * 86400_000).toISOString().slice(0, 10),
    km: 45,
    criadoEm: now,
  });

  console.log("Gravando despesas…");
  await db.collection("despesas").add({
    categoria: "Provas / Inscrições",
    equipe: "Corrida",
    evento: "Circuito das Estações — Etapa 1",
    avulso: false,
    propInsc: 1500,
    propTransp: 300,
    propHosp: 0,
    propAlim: 200,
    propDemais: 0,
    totalProposto: 2000,
    totalRealizado: 1800,
    criadoEm: now,
  });

  console.log("Gravando tema/configuracoes…");
  await db.collection("configuracoes").doc("tema").set({
    primary: "#009bc1",
    secondary: "#00b37e",
    accent: "#f37021",
    danger: "#e63946",
    bgLight: "#f0f4f8",
    bgDark: "#0f1117",
    cardDark: "#1a1d27",
    atualizadoEm: now,
  });

  console.log("\nSeed do legado concluído. Login demo:");
  console.log("  admin@demo.local / senha123");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
