/** Aéroports internationaux, ports, centrales non nucléaires (OpenStreetMap).
 * Trois requêtes séparées (chacune avec son cache) : une requête unique
 * dépasse le temps alloué par les instances publiques. */
import type { Ctx, Env, FeatureCollection } from "../types.ts";
import { queryOverpass } from "./overpass.ts";

const QUERIES: Record<string, { ql: string; label: string }> = {
  airports: {
    label: "Aéroport",
    ql: `[out:json][timeout:60];
(node["aeroway"="aerodrome"]["iata"]; way["aeroway"="aerodrome"]["iata"];);
out center 500;`,
  },
  ports: {
    label: "Port",
    ql: `[out:json][timeout:60];
(node["harbour"="yes"]["name"]; way["landuse"="port"]["name"];);
out center 300;`,
  },
  power: {
    label: "Centrale électrique",
    ql: `[out:json][timeout:60];
(node["power"="plant"]["name"]["plant:source"!="nuclear"]; way["power"="plant"]["name"]["plant:source"!="nuclear"];);
out center 300;`,
  },
};

export async function fetchInfrastructureSites(env: Env, ctx: Ctx, waitMs?: number): Promise<FeatureCollection> {
  const parts = await Promise.all(
    Object.entries(QUERIES).map(([name, q]) => queryOverpass(env, ctx, q.ql, `infra_${name}`, q.label, waitMs)),
  );
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
