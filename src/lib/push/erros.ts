/**
 * Por que ativar os avisos falhou, em português e com o que a pessoa pode
 * fazer. Puro (testável): recebe o erro do Firebase/navegador como veio.
 */
export type TipoErroPush = "rede" | "servico_push" | "bloqueado" | "sessao" | "outro";

export function classificarErroPush(erro: unknown): TipoErroPush {
  const texto = `${(erro as { code?: string })?.code ?? ""} ${erro instanceof Error ? erro.message : String(erro ?? "")}`;
  if (/Sessão expirada/i.test(texto)) return "sessao";
  if (/permission-blocked|permission-default|denied/i.test(texto)) return "bloqueado";
  // fcmregistrations / firebaseinstallations sem resposta: rede da empresa, proxy ou bloqueador.
  if (/failed to fetch|networkerror|load failed|network request failed|fcmregistrations|firebaseinstallations|installations\/app-offline/i.test(texto)) return "rede";
  // O navegador recusou a inscrição (ex.: Brave sem os serviços do Google, push desligado).
  if (/push service|registration failed|aborterror|token-subscribe-no-token|unsupported-browser/i.test(texto)) return "servico_push";
  return "outro";
}

export function mensagemDeErroPush(tipo: TipoErroPush, aparelho: "computador" | "celular") {
  switch (tipo) {
    case "rede":
      return aparelho === "computador"
        ? "Este computador não conseguiu falar com o serviço de avisos do Google. Costuma ser a rede da empresa ou um bloqueador de anúncios. Tente em outra rede (o 4G do celular, por exemplo) ou peça à TI para liberar fcmregistrations.googleapis.com."
        : "Não deu para falar com o serviço de avisos agora. Confira a internet e tente de novo; se estiver no Wi-Fi da empresa, tente pelo 4G.";
    case "servico_push":
      return "O navegador recusou a inscrição para avisos. No Brave, ligue “Usar os serviços do Google para mensagens push” nas configurações; nos outros, tente pelo Chrome ou pelo Edge.";
    case "bloqueado":
      return "As notificações estão bloqueadas neste navegador. Libere nas configurações do site e tente de novo.";
    case "sessao":
      return "Sua sessão expirou. Entre de novo e ative os avisos.";
    default:
      return "Não foi possível ativar os avisos agora. Tente de novo em alguns minutos.";
  }
}
