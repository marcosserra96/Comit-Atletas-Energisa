import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

export class ApiAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

export async function authenticatedFirebaseRequest(request: Request): Promise<{
  decodedToken: DecodedIdToken;
  db: Firestore;
}> {
  const token = bearerToken(request);
  if (!token) throw new ApiAuthError("Sessão não informada.", 401);

  const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
  const { auth, db } = getFirebaseAdmin();

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return { decodedToken, db };
  } catch {
    throw new ApiAuthError("Sua sessão expirou. Entre novamente.", 401);
  }
}

export async function authenticatedAdminRequest(request: Request) {
  const context = await authenticatedFirebaseRequest(request);
  const usuario = await context.db.collection("usuarios").doc(context.decodedToken.uid).get();

  if (!usuario.exists || usuario.data()?.role !== "administrador") {
    throw new ApiAuthError("Apenas administradores podem realizar esta ação.", 403);
  }

  return context;
}

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.name === "FirebaseAdminConfigError") {
    return Response.json({ error: error.message }, { status: 503 });
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
