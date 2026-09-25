import type {
  JustificativaAusenciaDoc,
  MotivoAusencia,
  PeriodicidadeAusencia,
  StatusJustificativaAusencia,
} from "@/lib/types";

export const MOTIVOS_AUSENCIA: Array<{ value: MotivoAusencia; label: string }> = [
  { value: "viagem", label: "Viagem" },
  { value: "doenca", label: "Doença" },
  { value: "lesao", label: "Lesão" },
  { value: "trabalho", label: "Trabalho" },
  { value: "pessoal", label: "Motivo pessoal" },
  { value: "outro", label: "Outro" },
];

export const motivoAusenciaLabel = Object.fromEntries(
  MOTIVOS_AUSENCIA.map((item) => [item.value, item.label]),
) as Record<MotivoAusencia, string>;

export const statusJustificativaLabel: Record<StatusJustificativaAusencia, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
  encerrada: "Encerrada",
};

export const periodicidadeAusenciaLabel: Record<PeriodicidadeAusencia, string> = {
  periodo: "Período contínuo",
  semanal: "Toda semana",
  mensal: "Todo mês",
};

export const DIAS_SEMANA = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
] as const;

export const motivosAusenciaValidos = new Set<MotivoAusencia>(
  MOTIVOS_AUSENCIA.map((item) => item.value),
);

export function dataCivilValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function intervaloAusenciaValido(inicio: string, fim: string) {
  return dataCivilValida(inicio) && dataCivilValida(fim) && inicio <= fim;
}

export function diasNoIntervalo(inicio: string, fim: string) {
  if (!intervaloAusenciaValido(inicio, fim)) return 0;
  const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
  const fimMs = Date.parse(`${fim}T00:00:00Z`);
  return Math.floor((fimMs - inicioMs) / 86_400_000) + 1;
}

export function periodosAusenciaSobrepostos(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
) {
  return inicioA <= fimB && inicioB <= fimA;
}

function periodicidadeDe(
  justificativa: Pick<JustificativaAusenciaDoc, "periodicidade">,
): PeriodicidadeAusencia {
  return justificativa.periodicidade ?? "periodo";
}

function fimComparavel(
  justificativa: Pick<
    JustificativaAusenciaDoc,
    "fim" | "semDataFinal" | "encerradaAPartirDe"
  >,
) {
  const fimSolicitado = justificativa.semDataFinal || !justificativa.fim
    ? "9999-12-31"
    : justificativa.fim;
  if (!justificativa.encerradaAPartirDe) return fimSolicitado;
  const diaAnterior = new Date(`${justificativa.encerradaAPartirDe}T00:00:00Z`);
  diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
  return diaAnterior.toISOString().slice(0, 10) < fimSolicitado
    ? diaAnterior.toISOString().slice(0, 10)
    : fimSolicitado;
}

function padraoAbrangeData(
  justificativa: Pick<
    JustificativaAusenciaDoc,
    "periodicidade" | "diasSemana" | "diasMes"
  >,
  data: string,
) {
  const periodicidade = periodicidadeDe(justificativa);
  if (periodicidade === "periodo") return true;
  const dataCivil = new Date(`${data}T00:00:00Z`);
  if (periodicidade === "semanal") {
    return (justificativa.diasSemana ?? []).includes(dataCivil.getUTCDay());
  }
  return (justificativa.diasMes ?? []).includes(dataCivil.getUTCDate());
}

export function justificativaAbrangeData(
  justificativa: Pick<
    JustificativaAusenciaDoc,
    | "inicio"
    | "fim"
    | "status"
    | "periodicidade"
    | "diasSemana"
    | "diasMes"
    | "semDataFinal"
    | "encerradaAPartirDe"
  >,
  data: string,
) {
  if (justificativa.status !== "aprovada" && justificativa.status !== "encerrada") {
    return false;
  }
  if (data < justificativa.inicio || data > fimComparavel(justificativa)) return false;
  return padraoAbrangeData(justificativa, data);
}

export function justificativasAusenciaSobrepostas(
  a: Pick<
    JustificativaAusenciaDoc,
    | "inicio"
    | "fim"
    | "periodicidade"
    | "diasSemana"
    | "diasMes"
    | "semDataFinal"
    | "encerradaAPartirDe"
  >,
  b: Pick<
    JustificativaAusenciaDoc,
    | "inicio"
    | "fim"
    | "periodicidade"
    | "diasSemana"
    | "diasMes"
    | "semDataFinal"
    | "encerradaAPartirDe"
  >,
) {
  const inicio = a.inicio > b.inicio ? a.inicio : b.inicio;
  const fimA = fimComparavel(a);
  const fimB = fimComparavel(b);
  const fim = fimA < fimB ? fimA : fimB;
  if (inicio > fim) return false;

  const cursor = new Date(`${inicio}T00:00:00Z`);
  const limiteNatural = new Date(`${fim}T00:00:00Z`);
  const limiteBusca = new Date(cursor);
  limiteBusca.setUTCFullYear(limiteBusca.getUTCFullYear() + 8);
  const limite = limiteNatural < limiteBusca ? limiteNatural : limiteBusca;

  while (cursor <= limite) {
    const data = cursor.toISOString().slice(0, 10);
    if (padraoAbrangeData(a, data) && padraoAbrangeData(b, data)) return true;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return false;
}

export function resumoPeriodicidade(
  justificativa: Pick<
    JustificativaAusenciaDoc,
    "periodicidade" | "diasSemana" | "diasMes"
  >,
) {
  const periodicidade = periodicidadeDe(justificativa);
  if (periodicidade === "periodo") return periodicidadeAusenciaLabel.periodo;
  if (periodicidade === "semanal") {
    const selecionados = new Set(justificativa.diasSemana ?? []);
    const dias = DIAS_SEMANA.filter((dia) => selecionados.has(dia.value)).map(
      (dia) => dia.label,
    );
    return `${periodicidadeAusenciaLabel.semanal}: ${dias.join(", ")}`;
  }
  const dias = [...(justificativa.diasMes ?? [])].sort((a, b) => a - b);
  return `${periodicidadeAusenciaLabel.mensal}: dia${dias.length === 1 ? "" : "s"} ${dias.join(", ")}`;
}

export function resumoJustificativa(
  justificativa: Pick<JustificativaAusenciaDoc, "motivo" | "descricao">,
) {
  const motivo = motivoAusenciaLabel[justificativa.motivo] ?? "Outro";
  return `${motivo}: ${justificativa.descricao.trim()}`;
}
