const CHAVE = "atletas-energisa:voltar";

/** Só links internos que fazem sentido retomar depois do login. */
function permitido(caminho: string) {
  return /^\/presenca\/[A-Za-z0-9_-]+(\?[^#]*)?$/.test(caminho);
}

/** Guarda o link aberto sem login (ex.: QR code da reunião) para voltar a ele. */
export function guardarVoltarPara(caminho: string) {
  if (!permitido(caminho)) return;
  try {
    sessionStorage.setItem(CHAVE, caminho);
  } catch {
    // Sem armazenamento: o atleta cai no início e escaneia de novo.
  }
}

/**
 * Lê o destino guardado sem apagar (o efeito do login pode rodar duas vezes).
 * Quem apaga é a área do atleta, ao abrir com a sessão ativa.
 */
export function lerVoltarPara(): string | null {
  try {
    const caminho = sessionStorage.getItem(CHAVE);
    return caminho && permitido(caminho) ? caminho : null;
  } catch {
    return null;
  }
}

export function limparVoltarPara() {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // nada a limpar
  }
}
