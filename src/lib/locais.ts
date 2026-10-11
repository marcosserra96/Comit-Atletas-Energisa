/**
 * Sugestões para o campo "Local" dos eventos: locais já usados pelo comitê e
 * lugares do mapa (OpenStreetMap, pelo serviço Photon). Tudo puro: o servidor
 * converte a resposta do mapa e a tela filtra os locais usados antes.
 */
import { normalizarTexto } from "@/lib/extrato";

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface SugestaoLocal {
  /** Texto que vai para o campo (e para o evento): "Parque do Ibirapuera, São Paulo". */
  valor: string;
  /** Linha principal na lista. */
  titulo: string;
  /** Linha de apoio: endereço, bairro, cidade. */
  detalhe: string;
  coordenadas?: Coordenadas;
  origem: "usado" | "mapa";
}

const UF: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF",
  "espirito santo": "ES", goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI",
  "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

export function siglaDoEstado(estado?: string) {
  if (!estado) return "";
  return UF[normalizarTexto(estado)] ?? estado;
}

/** O que o Photon devolve em cada resultado (só o que usamos). */
export interface LugarPhoton {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
    osm_value?: string;
    type?: string;
  };
}

/**
 * Converte um resultado do mapa numa sugestão. Fora do Brasil ou sem nome
 * aproveitável, fica de fora.
 */
export function sugestaoDoMapa(lugar: LugarPhoton): SugestaoLocal | null {
  const p = lugar.properties ?? {};
  if (p.countrycode && p.countrycode.toUpperCase() !== "BR") return null;
  const [lng, lat] = lugar.geometry?.coordinates ?? [];
  const cidade = p.city || p.locality || p.county || "";
  const uf = siglaDoEstado(p.state);
  const rua = p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ""}` : "";
  const ehCidade = p.type === "city" || p.osm_value === "city" || p.osm_value === "town" || p.osm_value === "village";
  const titulo = (p.name || rua || cidade).trim();
  if (!titulo) return null;

  const lugarDaCidade = ehCidade ? uf : [cidade !== titulo ? cidade : "", uf].filter(Boolean).join(" - ");
  const detalhe = ehCidade
    ? [p.state].filter(Boolean).join("")
    : [p.name && rua ? rua : "", p.district && p.district !== titulo ? p.district : "", lugarDaCidade].filter(Boolean).join(", ");
  // O que fica salvo é curto e reconhecível: "Nome, Cidade" (ou "Cidade, UF").
  const valor = ehCidade ? [titulo, uf].filter(Boolean).join(", ") : [titulo, cidade !== titulo ? cidade : ""].filter(Boolean).join(", ");
  return {
    valor,
    titulo,
    detalhe,
    coordenadas: Number.isFinite(lat) && Number.isFinite(lng) ? { lat: Number(lat), lng: Number(lng) } : undefined,
    origem: "mapa",
  };
}

/** Tira repetidos (mesmo texto salvo), mantendo a primeira ocorrência. */
export function semRepetidos(lista: readonly SugestaoLocal[]) {
  const vistos = new Set<string>();
  return lista.filter((s) => {
    const chave = normalizarTexto(s.valor);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/**
 * Locais que o comitê já usou, os mais frequentes primeiro, filtrados pelo
 * que foi digitado (sem acento, por palavra: "ibira sp" acha "Parque do Ibirapuera, São Paulo").
 */
export function locaisUsados(
  eventos: readonly { local?: string; online?: boolean; coordenadas?: Coordenadas | null }[],
  digitado: string,
  limite = 4,
): SugestaoLocal[] {
  const contagem = new Map<string, { valor: string; vezes: number; coordenadas?: Coordenadas }>();
  for (const e of eventos) {
    const valor = (e.local ?? "").trim();
    if (!valor || e.online || normalizarTexto(valor) === "online") continue;
    const chave = normalizarTexto(valor);
    const atual = contagem.get(chave) ?? { valor, vezes: 0, coordenadas: undefined };
    atual.vezes += 1;
    if (!atual.coordenadas && e.coordenadas) atual.coordenadas = e.coordenadas;
    contagem.set(chave, atual);
  }
  const termos = normalizarTexto(digitado).split(/\s+/).filter(Boolean);
  return [...contagem.entries()]
    .filter(([chave]) => termos.every((t) => chave.includes(t)) && chave !== normalizarTexto(digitado))
    .sort((a, b) => b[1].vezes - a[1].vezes || a[1].valor.localeCompare(b[1].valor, "pt-BR"))
    .slice(0, limite)
    .map(([, v]) => ({
      valor: v.valor,
      titulo: v.valor,
      detalhe: v.vezes === 1 ? "Usado em 1 evento" : `Usado em ${v.vezes} eventos`,
      coordenadas: v.coordenadas,
      origem: "usado" as const,
    }));
}

/** Link do mapa: pelas coordenadas quando o local veio do mapa; senão, pelo texto. */
export function linkDoMapa(evento: { local: string; coordenadas?: Coordenadas | null }) {
  const consulta = evento.coordenadas ? `${evento.coordenadas.lat},${evento.coordenadas.lng}` : evento.local;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
