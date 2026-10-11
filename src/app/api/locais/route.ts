import { apiErrorResponse, authenticatedPermissionRequest } from "@/lib/server/firebaseRequest";
import { semRepetidos, sugestaoDoMapa, type LugarPhoton, type SugestaoLocal } from "@/lib/locais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q= → { sugestoes } de lugares do mapa (OpenStreetMap, serviço Photon),
 * só do Brasil e com preferência pela região do programa. Passa pelo servidor
 * para guardar em cache e não depender de chave paga. Se o serviço falhar,
 * devolve lista vazia: o local digitado continua valendo.
 */
const PHOTON = "https://photon.komoot.io/api/";
// Cataguases (MG): centro da região do programa, para ordenar os resultados.
const PERTO_DE = { lat: -21.389, lon: -42.696 };
const BRASIL = "-74.0,-34.0,-34.7,5.3";
const CACHE_MS = 6 * 60 * 60_000;
const cache = new Map<string, { em: number; sugestoes: SugestaoLocal[] }>();

export async function GET(request: Request) {
  try {
    await authenticatedPermissionRequest(request, "eventos");
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 3) return Response.json({ sugestoes: [] });
    const chave = q.toLocaleLowerCase("pt-BR");
    const guardado = cache.get(chave);
    if (guardado && Date.now() - guardado.em < CACHE_MS) return Response.json({ sugestoes: guardado.sugestoes });

    const url = `${PHOTON}?${new URLSearchParams({ q, limit: "8", lat: String(PERTO_DE.lat), lon: String(PERTO_DE.lon), bbox: BRASIL })}`;
    let sugestoes: SugestaoLocal[] = [];
    try {
      const resposta = await fetch(url, {
        headers: { "User-Agent": "AtletasEnergisa/1.0 (portal do programa de atletas)" },
        signal: AbortSignal.timeout(4500),
      });
      if (resposta.ok) {
        const corpo = (await resposta.json()) as { features?: LugarPhoton[] };
        sugestoes = semRepetidos((corpo.features ?? []).map(sugestaoDoMapa).filter((s): s is SugestaoLocal => s !== null)).slice(0, 6);
        cache.set(chave, { em: Date.now(), sugestoes });
        if (cache.size > 500) cache.delete(cache.keys().next().value!);
      }
    } catch (error) {
      console.warn("Busca de lugares indisponível:", error instanceof Error ? error.message : error);
    }
    return Response.json({ sugestoes });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível buscar lugares agora.");
  }
}
