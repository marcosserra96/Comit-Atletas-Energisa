/**
 * Verificação read-only: mostra os documentos atletas/usuarios de um e-mail.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npx tsx scripts/verificar-usuario.ts --email=...
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function arg(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

async function main() {
  const email = arg("email");
  if (!email) {
    console.error("Uso: npx tsx scripts/verificar-usuario.ts --email=...");
    process.exit(1);
  }

  const app = initializeApp({ credential: applicationDefault() });
  const auth = getAuth(app);
  const db = getFirestore(app);

  const usuario = await auth.getUserByEmail(email).catch(() => null);
  if (!usuario) {
    console.log(`Nenhuma conta de autenticação encontrada para ${email}.`);
    process.exit(0);
  }
  console.log("Auth:", { uid: usuario.uid, email: usuario.email, nome: usuario.displayName });

  const usuarioDoc = await db.collection("usuarios").doc(usuario.uid).get();
  console.log("usuarios/" + usuario.uid + ":", usuarioDoc.exists ? usuarioDoc.data() : "(não existe)");

  const atletasSnap = await db.collection("atletas").where("authUid", "==", usuario.uid).get();
  if (atletasSnap.empty) {
    console.log("atletas: nenhum documento com esse authUid.");
  } else {
    atletasSnap.forEach((doc) => console.log(`atletas/${doc.id}:`, doc.data()));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
