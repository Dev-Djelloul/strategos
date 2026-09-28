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
import { queryOverpass, withConcurrency } from "./overpass.ts";

// Requêtes lancées 6 à la fois (voir withConcurrency) : toutes les lancer
// d'un coup (30 ici : 3 catégories x 10 pays) dépasse la limite de requêtes
// HTTP concurrentes du Worker.
const MAX_CONCURRENT = 6;
// cf. military.ts : borne le délai d'attente par combinaison pour que la
// requête globale réponde vite même à froid (30 combinaisons), quitte à
// laisser certaines encore "pas prêtes" à ce tour — elles se rattrapent en
// arrière-plan pour le prochain appel.
const DEFAULT_WAIT_MS = 2000;

const CATEGORIES: Record<string, { label: string; ql: (bbox: string) => string }> = {
  airports: {
    label: "Aéroport",
    ql: (bbox) => `[out:json][timeout:50];nwr["aeroway"="aerodrome"]["iata"]${bbox};out geom 500;`,
  },
  ports: {
    label: "Port",
    ql: (bbox) => `[out:json][timeout:50];
(
  nwr["harbour"="yes"]["name"]${bbox};
  way["landuse"="port"]["name"]${bbox};
);
out geom 300;`,
  },
  power: {
    label: "Centrale électrique",
    ql: (bbox) => `[out:json][timeout:50];nwr["power"="plant"]["name"]["plant:source"!="nuclear"]${bbox};out geom 300;`,
  },
};

export async function fetchInfrastructureSites(env: Env, ctx: Ctx, waitMs = DEFAULT_WAIT_MS): Promise<FeatureCollection> {
  const jobs = Object.entries(CATEGORIES).flatMap(([name, cat]) =>
    Object.entries(COUNTRY_BOUNDS).map(([code, bounds]) => ({ name, cat, code, bounds })),
  );
  const results = await withConcurrency(jobs, MAX_CONCURRENT, ({ name, cat, code, bounds: [west, south, east, north] }) =>
    queryOverpass(env, ctx, cat.ql(`(${south},${west},${north},${east})`), `infra_v2_${name}_${code}`, cat.label, waitMs),
  );
  // cf. fetchMilitarySites : un pays/catégorie en échec ne doit pas priver
  // l'utilisateur de ceux déjà disponibles — seul un échec total est une panne.
  const parts = results.filter((p): p is FeatureCollection => p !== null);
  if (!parts.length) throw new Error("aucune donnée disponible pour l'instant (source lente)");
  const stale = parts.filter((p) => p.stale);
  const result: FeatureCollection = {
    type: "FeatureCollection",
    features: parts.flatMap((p) => p.features),
    fetched_at: parts.map((p) => p.fetched_at as string).sort()[0],
    stale: stale.length > 0 || parts.length < results.length,
  };
  if (stale.length) result.stale_reason = stale[0].stale_reason;
  else if (parts.length < results.length) result.stale_reason = `${results.length - parts.length} zone(s) pas encore chargée(s)`;
  return result;
}
