const messages: Record<string, string> = {
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Este acesso foi desativado. Fale com o administrador.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  "auth/expired-action-code": "Este link expirou. Volte ao login e solicite um novo.",
  "auth/invalid-action-code": "Este link é inválido ou já foi utilizado. Solicite um novo.",
  "auth/missing-action-code": "Este link está incompleto. Solicite um novo.",
  "auth/invalid-continue-uri": "O endereço de retorno do portal é inválido. Fale com o administrador técnico.",
  "auth/unauthorized-continue-uri": "Este endereço do portal ainda não está autorizado no Firebase.",
  "auth/invalid-api-key": "Portal ainda não configurado com o Firebase. Fale com o administrador técnico.",
  "auth/configuration-not-found": "Portal ainda não configurado com o Firebase. Fale com o administrador técnico.",
  "permission-denied": "Você não tem permissão para fazer isso.",
};

export function mapFirebaseError(code: unknown): string {
  if (typeof code === "string" && messages[code]) return messages[code];
  return "Algo deu errado. Tente novamente em instantes.";
}

export function firebaseErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}
