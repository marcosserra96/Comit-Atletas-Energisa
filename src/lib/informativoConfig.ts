import type { InformativoConfigDoc } from "@/lib/types";

export const INFORMATIVO_PADRAO: InformativoConfigDoc = {
  modalidade: "todos",
  limite: 28,
  paginasSeparadas: true,
  mostrarKpis: true,
  mostrarLegenda: true,
  mostrarTop3: true,
  mostrarAlertas: true,
  mostrarDemais: true,
  alertaCriterio: "sem_treino_mes",
  alertaValor: 30,
};

export function normalizarInformativoConfig(config: Partial<InformativoConfigDoc> = {}): InformativoConfigDoc {
  return { ...INFORMATIVO_PADRAO, ...config };
}
