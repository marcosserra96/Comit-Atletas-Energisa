/**
 * Remove uma conta criada por engano (Auth + documentos Firestore
 * atletas/usuarios correspondentes), pelo e-mail.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npx tsx scripts/cleanup-admin-placeholder.ts --email=seu-email@energisa.com.br
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
    console.error("Uso: npx tsx scripts/cleanup-admin-placeholder.ts --email=...");
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

  const atletasSnap = await db.collection("atletas").where("authUid", "==", usuario.uid).get();
  for (const doc of atletasSnap.docs) {
    await doc.ref.delete();
    console.log(`Apagado atletas/${doc.id}`);
  }

  await db.collection("usuarios").doc(usuario.uid).delete();
  console.log(`Apagado usuarios/${usuario.uid}`);

  await auth.deleteUser(usuario.uid);
  console.log(`Apagada conta de autenticação de ${email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
