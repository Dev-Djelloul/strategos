/** Bases militaires nommées et publiques, via OpenStreetMap (Overpass).
 *
 * Restrictions nécessaires pour rester sous le temps alloué par les
 * instances publiques :
 *  - valeurs military=* limitées à celles qui correspondent à une base
 *    (bunker/trench à eux seuls forment >65% des ~370 valeurs de la clé
 *    dans OSM, en immense majorité des vestiges historiques non nommés) ;
 *  - comparaison exacte ("=", pas "~") : une regex empêche Overpass
 *    d'utiliser l'index par valeur et force un scan complet ;
 *  - une requête séparée (avec son propre cache) par pays de conflit
 *    suivi par l'app plutôt qu'une requête mondiale ou même un seul pays
 *    très étendu (la Russie seule timeout encore si on la garde dans une
 *    requête combinée) : ainsi un pays lent n'empêche pas les autres de
 *    répondre, et on obtient des données partielles plutôt que rien. */
import type { Ctx, Env, FeatureCollection } from "../types.ts";
import { COUNTRY_BOUNDS } from "./acled.ts";
import { queryOverpass, withConcurrency } from "./overpass.ts";

const BASE_VALUES = ["base", "barracks", "naval_base", "airfield", "office", "depot"];
// Requêtes par pays lancées 4 à la fois (voir withConcurrency) : toutes les
// lancer d'un coup dépasse la limite de requêtes HTTP concurrentes du Worker.
const MAX_CONCURRENT = 4;

function queryFor(bboxClause: string): string {
  return `[out:json][timeout:50];
(
  ${BASE_VALUES.map((v) => `nwr["military"="${v}"]["name"]${bboxClause};`).join("\n  ")}
);
out geom 400;`;
}

export async function fetchMilitarySites(env: Env, ctx: Ctx, waitMs?: number): Promise<FeatureCollection> {
  const results = await withConcurrency(Object.entries(COUNTRY_BOUNDS), MAX_CONCURRENT, ([code, [west, south, east, north]]) =>
    queryOverpass(env, ctx, queryFor(`(${south},${west},${north},${east})`), `military_v2_${code}`, "Site militaire", waitMs),
  );
  // Un pays en échec (source lente, jamais encore en cache) ne doit pas
  // priver l'utilisateur des pays déjà disponibles — seul un échec total
  // (aucun pays, même en cache) est une vraie panne.
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
