/** Client UCDP GED (Uppsala Conflict Data Program). Jeton gratuit,
 * secret UCDP_ACCESS_TOKEN (limite : 5 000 requêtes/jour, erreurs comprises).
 *
 * La version annuelle (26.1) a ~9 mois de retard : pour les données
 * récentes on interroge les versions "candidate" mensuelles (26.0.N, en
 * pratique ~2 semaines de décalage). Les versions disponibles sont
 * découvertes une fois par jour (cache KV) ; les événements d'une fenêtre
 * sont mis en cache 6 h, puis filtrés (pays, type) en mémoire : le nombre de
 * requêtes UCDP reste très inférieur à la limite. */
import type { Ctx, Env, Feature, FeatureCollection } from "../types.ts";
import { COUNTRIES } from "./acled.ts";
import { cachedFetch } from "../cache.ts";

const API_URL = "https://ucdpapi.pcr.uu.se/api/gedevents";
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const MAX_VERSIONS = 3;
const EVENTS_TTL_SECONDS = 6 * 3600;
const VERSIONS_TTL_SECONDS = 24 * 3600;

// type_of_violence : 1 = conflit étatique, 2 = non étatique, 3 = violence unilatérale
const VIOLENCE_TO_TYPE: Record<number, string> = { 1: "offensive", 2: "offensive", 3: "casualties" };
const NAME_TO_CODE = Object.fromEntries(Object.entries(COUNTRIES).map(([code, name]) => [name, code]));

interface UcdpRow {
  id?: number;
  latitude?: number | string;
  longitude?: number | string;
  type_of_violence?: number;
  where_coordinates?: string;
  country?: string;
  best?: number;
  date_end?: string;
  side_a?: string;
  side_b?: string;
}

async function ucdpGet(env: Env, version: string, params: Record<string, string>): Promise<Response> {
  return fetch(`${API_URL}/${version}?${new URLSearchParams(params)}`, {
    headers: { "x-ucdp-access-token": env.UCDP_ACCESS_TOKEN as string },
  });
}

/** Versions candidate mensuelles disponibles (les plus récentes d'abord). */
async function discoverVersions(env: Env, ctx: Ctx): Promise<string[]> {
  if (env.UCDP_GED_VERSION) return env.UCDP_GED_VERSION.split(",").map((v) => v.trim());
  const found = await cachedFetch(env, ctx, "ucdp_versions", VERSIONS_TTL_SECONDS, async () => {
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(2);
    const versions: string[] = [];
    for (let m = now.getUTCMonth() + 2; m >= 1 && versions.length < MAX_VERSIONS; m--) {
      const v = `${yy}.0.${m}`;
      const res = await ucdpGet(env, v, { pagesize: "1" });
      if (res.ok) versions.push(v);
      else if (res.status !== 400 && res.status !== 404) throw new Error(`UCDP HTTP ${res.status} (${v})`);
    }
    if (!versions.length) throw new Error("aucune version candidate UCDP trouvée");
    return { type: "FeatureCollection", features: [], versions };
  });
  return found.versions as string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function fetchWindow(env: Env, ctx: Ctx, days: number): Promise<FeatureCollection> {
  const versions = await discoverVersions(env, ctx);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const seen = new Set<number>();
  const features: Feature[] = [];

  for (const version of versions) {
    for (let page = 0; page < MAX_PAGES; page++) {
      // Pas de StartDate/EndDate côté API : ils ignorent des événements
      // récents (0 résultat en septembre alors que la version en contient).
      // Une version candidate ne pèse que ~2 pages : on filtre les dates ici.
      const res = await ucdpGet(env, version, { pagesize: String(PAGE_SIZE), page: String(page) });
      if (!res.ok) throw new Error(`UCDP a refusé la requête (${res.status}, version ${version}): ${(await res.text()).slice(0, 160)}`);
      const payload = (await res.json()) as { Result?: UcdpRow[]; TotalPages?: number };
      for (const r of payload.Result ?? []) {
        if (r.id !== undefined) {
          if (seen.has(r.id)) continue; // une même fenêtre peut figurer dans deux versions
          seen.add(r.id);
        }
        const lat = Number(r.latitude);
        const lon = Number(r.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
        const day = (r.date_end ?? "").slice(0, 10);
        if (day && (day < iso(start) || day > iso(end))) continue;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: {
            name: `${r.where_coordinates ?? "?"}, ${r.country ?? "?"}`,
            event_type: VIOLENCE_TO_TYPE[r.type_of_violence ?? 1] ?? "offensive",
            fatalities: r.best ?? null,
            event_date: (r.date_end ?? "").slice(0, 10) || null,
            country_name: r.country ?? null,
            country: r.country ? NAME_TO_CODE[r.country] ?? null : null,
            notes: `${r.side_a ?? "?"} / ${r.side_b ?? "?"}`.slice(0, 280),
          },
        });
      }
      if (page + 1 >= (payload.TotalPages ?? 1)) break;
    }
  }
  const dates = features.map((f) => f.properties.event_date as string).filter(Boolean).sort();
  return { type: "FeatureCollection", features, versions, latest_date: dates.at(-1) ?? null };
}

export async function fetchUcdpEvents(
  env: Env,
  ctx: Ctx,
  opts: { eventType: string; country: string | null; days: number },
): Promise<FeatureCollection> {
  if (!env.UCDP_ACCESS_TOKEN) {
    throw new Error(
      "UCDP_ACCESS_TOKEN absent : demande un jeton gratuit à mertcan.yilmaz@pcr.uu.se " +
        "puis `wrangler secret put UCDP_ACCESS_TOKEN`",
    );
  }
  // Fenêtres regroupées (7/30/90 j) pour mutualiser le cache entre requêtes.
  const bucket = opts.days <= 7 ? 7 : opts.days <= 30 ? 30 : 90;
  const all = await cachedFetch(env, ctx, `ucdp_events_v2_${bucket}`, EVENTS_TTL_SECONDS, () => fetchWindow(env, ctx, bucket), 25000);

  const cutoff = iso(new Date(Date.now() - opts.days * 86400000));
  const countryName = opts.country ? COUNTRIES[opts.country] : null;
  const features = all.features.filter((f) => {
    const p = f.properties;
    if (p.event_date && p.event_date < cutoff) return false;
    if (opts.eventType !== "all" && p.event_type !== opts.eventType) return false;
    if (countryName && p.country_name !== countryName) return false;
    return true;
  });
  return {
    type: "FeatureCollection",
    features,
    // Dernière date disponible dans la version candidate (décalage de publication).
    meta: { latest_date: all.latest_date ?? null, versions: all.versions, stale: all.stale ?? false },
  };
}
