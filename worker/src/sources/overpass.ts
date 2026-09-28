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
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Moyenne des sommets d'un tracé (way) : pour une forme allongée (barrage,
 * jetée...), plus fidèle que le centre de sa boîte englobante — celui-ci
 * peut tomber hors de la structure dès qu'elle n'est pas droite/rectangulaire
 * (ex. un barrage en diagonale, dont le centre de la boîte tombe dans l'eau). */
function centroid(points: { lat: number; lon: number }[]): { lat: number; lon: number } {
  let sumLat = 0;
  let sumLon = 0;
  for (const pt of points) {
    sumLat += pt.lat;
    sumLon += pt.lon;
  }
  return { lat: sumLat / points.length, lon: sumLon / points.length };
}

function toGeoJson(elements: OsmElement[], nameFallback: string): FeatureCollection {
  const features: Feature[] = [];
  for (const el of elements) {
    const p = el.type === "node" ? el : el.geometry?.length ? centroid(el.geometry) : el.center;
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

/** Exécute `items` avec au plus `limit` appels concurrents.
 *
 * Nécessaire dès qu'on interroge Overpass par pays (une requête par région
 * plutôt qu'une seule mondiale) : lancer toutes les requêtes d'un coup en
 * Promise.all ouvre autant de connexions simultanées vers le même hôte, ce
 * qui dépasse la limite de requêtes HTTP concurrentes d'un Worker — les
 * plus anciennes sont alors annulées de force ("stalled HTTP response was
 * canceled to prevent deadlock") avant même d'avoir une réponse. */
// `null` marque un item qui a échoué (ex. pays trop lent) : sans ce filet,
// une exception non rattrapée dans un worker interrompait sa boucle pour de
// bon (les items suivants qui lui étaient assignés n'étaient jamais tentés)
// et faisait échouer tout le lot via Promise.all — à l'exact opposé du but
// de cette fonction, qui est d'obtenir les résultats rapides malgré les lents.
export async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    for (let i = next++; i < items.length; i = next++) {
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
