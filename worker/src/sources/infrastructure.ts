/** Aéroports internationaux, ports, centrales non nucléaires (OpenStreetMap).
 *
 * Une requête séparée (avec son propre cache) par catégorie ET par pays de
 * conflit suivi par l'app, plutôt qu'une requête mondiale ou par catégorie
 * seule : constaté empiriquement qu'une requête, même limitée à un seul
 * pays très étendu comme la Russie, peut dépasser le temps alloué par les
 * instances publiques. Isoler par pays permet d'obtenir des données
 * partielles (les pays rapides répondent) plutôt que rien du tout. */
import type { Ctx, Env, FeatureCollection } from "../types.ts";
import { COUNTRY_BOUNDS } from "./acled.ts";
import { queryOverpass } from "./overpass.ts";

const CATEGORIES: Record<string, { label: string; ql: (bbox: string) => string }> = {
  airports: {
    label: "Aéroport",
    ql: (bbox) => `[out:json][timeout:50];nwr["aeroway"="aerodrome"]["iata"]${bbox};out center 500;`,
  },
  ports: {
    label: "Port",
    ql: (bbox) => `[out:json][timeout:50];
(
  nwr["harbour"="yes"]["name"]${bbox};
  way["landuse"="port"]["name"]${bbox};
);
out center 300;`,
  },
  power: {
    label: "Centrale électrique",
    ql: (bbox) => `[out:json][timeout:50];nwr["power"="plant"]["name"]["plant:source"!="nuclear"]${bbox};out center 300;`,
  },
};

export async function fetchInfrastructureSites(env: Env, ctx: Ctx, waitMs?: number): Promise<FeatureCollection> {
  const jobs = Object.entries(CATEGORIES).flatMap(([name, cat]) =>
    Object.entries(COUNTRY_BOUNDS).map(([code, [west, south, east, north]]) =>
      queryOverpass(env, ctx, cat.ql(`(${south},${west},${north},${east})`), `infra_${name}_${code}`, cat.label, waitMs),
    ),
  );
  const parts = await Promise.all(jobs);
  const stale = parts.filter((p) => p.stale);
  const result: FeatureCollection = {
    type: "FeatureCollection",
    features: parts.flatMap((p) => p.features),
    fetched_at: parts.map((p) => p.fetched_at as string).sort()[0],
    stale: stale.length > 0,
  };
  if (stale.length) result.stale_reason = stale[0].stale_reason;
  return result;
}
