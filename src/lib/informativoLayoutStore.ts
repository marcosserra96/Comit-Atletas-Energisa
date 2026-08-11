import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CAMPOS_ORDEM,
  INFORMATIVO_LAYOUT_EXTRAS_PADRAO,
  INFORMATIVO_LAYOUT_PADRAO,
  type CampoId,
  type CampoLayout,
  type InformativoLayoutExtras,
  type LayoutInformativo,
} from "@/lib/informativoLayout";

/**
 * Leitura/escrita do layout salvo. Fica separado de informativoLayout.ts (que só
 * tem as definições puras) pra que o gerador de PDF não arraste o Firebase junto.
 */

function normalizar(
  salvoCampos: Partial<Record<CampoId, Partial<CampoLayout>>> = {},
  salvoExtras: Partial<InformativoLayoutExtras> = {},
): LayoutInformativo {
  const campos = {} as Record<CampoId, CampoLayout>;
  for (const id of CAMPOS_ORDEM) {
    campos[id] = { ...INFORMATIVO_LAYOUT_PADRAO[id], ...salvoCampos[id] };
  }
  return { campos, extras: { ...INFORMATIVO_LAYOUT_EXTRAS_PADRAO, ...salvoExtras } };
}

const LAYOUT_REF = () => doc(db, "configuracoes", "informativo_layout");

export async function carregarLayoutInformativo(): Promise<LayoutInformativo> {
  const snap = await getDoc(LAYOUT_REF());
  const dados = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  return normalizar(
    dados.campos as Partial<Record<CampoId, Partial<CampoLayout>>> | undefined,
    dados.extras as Partial<InformativoLayoutExtras> | undefined,
  );
}

export async function salvarLayoutInformativo(layout: LayoutInformativo, uid: string) {
  await setDoc(LAYOUT_REF(), {
    campos: layout.campos,
    extras: layout.extras,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  });
}
