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
import { queryOverpass } from "./overpass.ts";

const BASE_VALUES = ["base", "barracks", "naval_base", "airfield", "office", "depot"];

function queryFor(bboxClause: string): string {
  return `[out:json][timeout:50];
(
  ${BASE_VALUES.map((v) => `nwr["military"="${v}"]["name"]${bboxClause};`).join("\n  ")}
);
out center 400;`;
}

export async function fetchMilitarySites(env: Env, ctx: Ctx, waitMs?: number): Promise<FeatureCollection> {
  const parts = await Promise.all(
    Object.entries(COUNTRY_BOUNDS).map(([code, [west, south, east, north]]) =>
      queryOverpass(env, ctx, queryFor(`(${south},${west},${north},${east})`), `military_${code}`, "Site militaire", waitMs),
    ),
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
