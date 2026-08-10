import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Posição (no espaço de coordenadas do fundo, 1672x941) e tamanho de fonte de um campo do informativo. */
export interface CampoLayout {
  x: number;
  y: number;
  fontSize: number;
}

export type CampoId =
  | "mesLabel"
  | "kpi1"
  | "kpi2"
  | "kpi3"
  | "kpi4"
  | "podio2Pts"
  | "podio2Treinos"
  | "podio2Km"
  | "podio1Pts"
  | "podio1Treinos"
  | "podio1Km"
  | "podio3Pts"
  | "podio3Treinos"
  | "podio3Km";

export const CAMPOS_ORDEM: CampoId[] = [
  "mesLabel",
  "kpi1",
  "kpi2",
  "kpi3",
  "kpi4",
  "podio2Pts",
  "podio2Treinos",
  "podio2Km",
  "podio1Pts",
  "podio1Treinos",
  "podio1Km",
  "podio3Pts",
  "podio3Treinos",
  "podio3Km",
];

export const CAMPOS_INFO: Record<CampoId, { label: string; grupo: string }> = {
  mesLabel: { label: "Mês (ex: Junho de 2026)", grupo: "Cabeçalho" },
  kpi1: { label: "Pontos totais do mês", grupo: "KPIs" },
  kpi2: { label: "Quantidade de treinos", grupo: "KPIs" },
  kpi3: { label: "KM acumulados", grupo: "KPIs" },
  kpi4: { label: "Atletas no ranking", grupo: "KPIs" },
  podio2Pts: { label: "2º lugar — pontos", grupo: "Pódio" },
  podio2Treinos: { label: "2º lugar — treinos", grupo: "Pódio" },
  podio2Km: { label: "2º lugar — km", grupo: "Pódio" },
  podio1Pts: { label: "1º lugar — pontos", grupo: "Pódio" },
  podio1Treinos: { label: "1º lugar — treinos", grupo: "Pódio" },
  podio1Km: { label: "1º lugar — km", grupo: "Pódio" },
  podio3Pts: { label: "3º lugar — pontos", grupo: "Pódio" },
  podio3Treinos: { label: "3º lugar — treinos", grupo: "Pódio" },
  podio3Km: { label: "3º lugar — km", grupo: "Pódio" },
};

/** Valores medidos pixel a pixel nas imagens informativo-fundo-*.png — o ponto de partida antes de qualquer ajuste manual. */
export const INFORMATIVO_LAYOUT_PADRAO: Record<CampoId, CampoLayout> = {
  mesLabel: { x: 525, y: 137, fontSize: 15 },
  kpi1: { x: 831, y: 138.5, fontSize: 21 },
  kpi2: { x: 1051, y: 138, fontSize: 21 },
  kpi3: { x: 1266, y: 136, fontSize: 21 },
  kpi4: { x: 1517, y: 137.5, fontSize: 21 },
  podio2Pts: { x: 90, y: 448, fontSize: 12 },
  podio2Treinos: { x: 90, y: 494.5, fontSize: 12 },
  podio2Km: { x: 90, y: 539.5, fontSize: 12 },
  podio1Pts: { x: 274, y: 444.5, fontSize: 12 },
  podio1Treinos: { x: 274, y: 470.5, fontSize: 12 },
  podio1Km: { x: 274, y: 509.5, fontSize: 12 },
  podio3Pts: { x: 464, y: 471, fontSize: 12 },
  podio3Treinos: { x: 464, y: 508.5, fontSize: 12 },
  podio3Km: { x: 464, y: 550, fontSize: 12 },
};

function normalizar(salvo: Partial<Record<CampoId, Partial<CampoLayout>>> = {}): Record<CampoId, CampoLayout> {
  const resultado = {} as Record<CampoId, CampoLayout>;
  for (const id of CAMPOS_ORDEM) {
    resultado[id] = { ...INFORMATIVO_LAYOUT_PADRAO[id], ...salvo[id] };
  }
  return resultado;
}

const LAYOUT_REF = () => doc(db, "configuracoes", "informativo_layout");

export async function carregarLayoutInformativo(): Promise<Record<CampoId, CampoLayout>> {
  const snap = await getDoc(LAYOUT_REF());
  return normalizar(snap.exists() ? (snap.data().campos as Partial<Record<CampoId, Partial<CampoLayout>>>) : {});
}

export async function salvarLayoutInformativo(campos: Record<CampoId, CampoLayout>, uid: string) {
  await setDoc(LAYOUT_REF(), { campos, atualizadoEm: serverTimestamp(), atualizadoPor: uid });
}
