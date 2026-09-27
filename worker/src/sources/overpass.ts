/** Client Overpass (OpenStreetMap) : instances publiques essayées dans
 * l'ordre, timeouts silencieux détectés, résultat mis en cache KV. */
import type { Ctx, Env, Feature, FeatureCollection } from "../types.ts";
import { USER_AGENT } from "../types.ts";
import { cachedFetch, errMessage } from "../cache.ts";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const CACHE_TTL_SECONDS = 6 * 3600;

interface OsmElement {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function toGeoJson(elements: OsmElement[], nameFallback: string): FeatureCollection {
  const features: Feature[] = [];
  for (const el of elements) {
    const p = el.type === "node" ? el : el.center;
    if (p?.lat === undefined || p?.lon === undefined) continue;
    const tags = el.tags ?? {};
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        name: tags.name ?? nameFallback,
        type: tags.military ?? tags.aeroway ?? tags.power ?? tags.landuse ?? null,
        operator: tags.operator ?? null,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

async function queryMirrors(queryQl: string): Promise<{ elements?: OsmElement[]; remark?: string }> {
  const failures: string[] = [];
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        // overpass-api.de renvoie 406 depuis avril 2026 aux clients sans
        // Accept / Accept-Encoding explicites (durcissement anti-bot).
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Accept-Encoding": "gzip",
        },
        body: new URLSearchParams({ data: queryQl }),
        signal: AbortSignal.timeout(70000), // une instance qui ne répond pas ne bloque pas les autres
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      // Overpass répond 200 avec 0 élément et une "remark" quand la requête
      // dépasse son temps alloué : c'est une panne, pas un résultat vide.
      if ((payload.remark ?? "").includes("runtime error")) throw new Error(payload.remark);
      return payload;
    } catch (e) {
      failures.push(`${new URL(url).host} : ${errMessage(e)}`);
    }
  }
  throw new Error(failures.join(" ; "));
}

export function queryOverpass(
  env: Env,
  ctx: Ctx,
  queryQl: string,
  cacheKey: string,
  nameFallback: string,
  waitMs?: number,
): Promise<FeatureCollection> {
  return cachedFetch(
    env, ctx, `overpass_${cacheKey}`, CACHE_TTL_SECONDS,
    async () => toGeoJson((await queryMirrors(queryQl)).elements ?? [], nameFallback),
    waitMs,
  );
}
