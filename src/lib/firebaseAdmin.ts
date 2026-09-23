import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_APP_NAME = "atletas-energisa-admin";

interface ServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export class FirebaseAdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseAdminConfigError";
  }
}

function serviceAccountConfig(): ServiceAccountConfig {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

  if (json) {
    try {
      const value = JSON.parse(json) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (value.project_id && value.client_email && value.private_key) {
        return {
          projectId: value.project_id,
          clientEmail: value.client_email,
          privateKey: value.private_key,
        };
      }
    } catch {
      throw new FirebaseAdminConfigError(
        "A credencial administrativa do Firebase contém um JSON inválido.",
      );
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAdminConfigError(
      "A integração administrativa do Firebase ainda não foi configurada na Vercel.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function adminApp(): App {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const config = serviceAccountConfig();
  const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (publicProjectId && publicProjectId !== config.projectId) {
    throw new FirebaseAdminConfigError(
      "A credencial administrativa pertence a outro projeto Firebase.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
    },
    ADMIN_APP_NAME,
  );
}

export function getFirebaseAdmin() {
  const app = adminApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}
