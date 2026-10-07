/** Regras de imagem que valem no servidor e no navegador. */

/** Foto do atleta: quadrada, JPEG, já reduzida no aparelho (~25 KB). */
export const FOTO_LADO = 360;
export const FOTO_TAMANHO_MAXIMO = 180_000;

/** Imagem de slide livre: até 1600 px no lado maior. */
export const IMAGEM_SLIDE_LADO = 1600;
export const IMAGEM_SLIDE_TAMANHO_MAXIMO = 850_000;

const PREFIXOS = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"];

function dataUrlValida(v: unknown, maximo: number): v is string {
  return (
    typeof v === "string" &&
    v.length <= maximo &&
    PREFIXOS.some((p) => v.startsWith(p)) &&
    /^[A-Za-z0-9+/=]+$/.test(v.slice(v.indexOf(",") + 1))
  );
}

export const fotoValida = (v: unknown): v is string => dataUrlValida(v, FOTO_TAMANHO_MAXIMO);
export const imagemSlideValida = (v: unknown): v is string => dataUrlValida(v, IMAGEM_SLIDE_TAMANHO_MAXIMO);

/** "Ana Beatriz Lima" → "AL" */
export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? "" : "";
  return (primeira + ultima).toUpperCase();
}
