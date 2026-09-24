/** Installations nucléaires civiles déclarées (Wikidata SPARQL, sans clé).
 * Volontairement limité aux sites civils publics et documentés. */
import type { Ctx, Env, Feature, FeatureCollection } from "../types.ts";
import { USER_AGENT } from "../types.ts";
import { cachedFetch } from "../cache.ts";

const SPARQL_URL = "https://query.wikidata.org/sparql";
const CACHE_TTL_SECONDS = 24 * 3600;

// Q159313 = centrale nucléaire ; P625 = coordonnées ; P17 = pays ; P5817 = statut
const SPARQL_QUERY = `
SELECT ?itemLabel ?coord ?countryLabel ?statusLabel WHERE {
  ?item wdt:P31 wd:Q159313.
  ?item wdt:P625 ?coord.
  OPTIONAL { ?item wdt:P17 ?country. }
  OPTIONAL { ?item wdt:P5817 ?status. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}`;

type Binding = Record<string, { value: string } | undefined>;

async function fetchFromWikidata(): Promise<FeatureCollection> {
  const res = await fetch(`${SPARQL_URL}?${new URLSearchParams({ query: SPARQL_QUERY, format: "json" })}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const payload = (await res.json()) as { results?: { bindings?: Binding[] } };

  const features: Feature[] = [];
  for (const row of payload.results?.bindings ?? []) {
    // Format Wikidata : "Point(lon lat)"
    const m = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(row.coord?.value ?? "");
    if (!m) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [parseFloat(m[1]), parseFloat(m[2])] },
      properties: {
        name: row.itemLabel?.value ?? "Site nucléaire",
        country: row.countryLabel?.value ?? null,
        status: row.statusLabel?.value ?? null,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export const fetchNuclearSites = (env: Env, ctx: Ctx, waitMs = 15000): Promise<FeatureCollection> =>
  cachedFetch(env, ctx, "wikidata_nuclear", CACHE_TTL_SECONDS, fetchFromWikidata, waitMs);
