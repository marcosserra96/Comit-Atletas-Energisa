/**
 * Presença em reunião: o lançamento tem id fixo por reunião e atleta, para a
 * marcação manual e a confirmação pelo app (QR code) nunca contarem duas vezes.
 */
export function idPresencaReuniao(reuniaoId: string, atletaId: string) {
  return `reuniao_${reuniaoId}_${atletaId}`;
}

/** Todas as presenças da mesma reunião formam uma atividade só por atleta. */
export function loteDaReuniao(reuniaoId: string) {
  return `reuniao_${reuniaoId}`;
}
