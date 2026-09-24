/** Bases militaires nommées et publiques, via OpenStreetMap (Overpass). */
import type { Ctx, Env, FeatureCollection } from "../types.ts";
import { queryOverpass } from "./overpass.ts";

const QUERY = `[out:json][timeout:60];
(
  node["military"]["name"];
  way["military"]["name"];
  relation["military"]["name"];
);
out center 400;`;

export const fetchMilitarySites = (env: Env, ctx: Ctx): Promise<FeatureCollection> =>
  queryOverpass(env, ctx, QUERY, "military", "Site militaire");
