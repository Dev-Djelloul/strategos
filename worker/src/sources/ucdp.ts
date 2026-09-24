/** Client UCDP GED (Uppsala Conflict Data Program). Jeton gratuit à
 * demander à l'équipe UCDP, secret UCDP_ACCESS_TOKEN. */
import type { Env, Feature, FeatureCollection } from "../types.ts";
import { COUNTRIES } from "./acled.ts";

const API_URL = "https://ucdpapi.pcr.uu.se/api/gedevents";
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;

// type_of_violence : 1 = conflit étatique, 2 = non étatique, 3 = violence unilatérale
const VIOLENCE_TO_TYPE: Record<number, string> = { 1: "offensive", 2: "offensive", 3: "casualties" };
const NAME_TO_CODE = Object.fromEntries(Object.entries(COUNTRIES).map(([code, name]) => [name, code]));

interface UcdpRow {
  latitude?: number | string;
  longitude?: number | string;
  type_of_violence?: number;
  where_coordinates?: string;
  country?: string;
  best?: number;
  date_start?: string;
  side_a?: string;
  side_b?: string;
}

export async function fetchUcdpEvents(
  env: Env,
  opts: { eventType: string; country: string | null; days: number },
): Promise<FeatureCollection> {
  if (!env.UCDP_ACCESS_TOKEN) {
    throw new Error(
      "UCDP_ACCESS_TOKEN absent : demande un jeton gratuit à mertcan.yilmaz@pcr.uu.se " +
        "puis `wrangler secret put UCDP_ACCESS_TOKEN`",
    );
  }
  const version = env.UCDP_GED_VERSION ?? "26.1";
  const end = new Date();
  const start = new Date(end.getTime() - opts.days * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const countryName = opts.country ? COUNTRIES[opts.country] : null;

  const rows: UcdpRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      pagesize: String(PAGE_SIZE), page: String(page), StartDate: iso(start), EndDate: iso(end),
    });
    const res = await fetch(`${API_URL}/${version}?${params}`, {
      headers: { "x-ucdp-access-token": env.UCDP_ACCESS_TOKEN },
    });
    if (!res.ok) throw new Error(`UCDP a refusé la requête (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const payload = (await res.json()) as { Result?: UcdpRow[]; TotalPages?: number };
    rows.push(...(payload.Result ?? []));
    if (page + 1 >= (payload.TotalPages ?? 1)) break;
  }

  const features: Feature[] = [];
  for (const r of rows) {
    const etype = VIOLENCE_TO_TYPE[r.type_of_violence ?? 1] ?? "offensive";
    if (opts.eventType !== "all" && etype !== opts.eventType) continue;
    if (countryName && r.country !== countryName) continue;
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        name: `${r.where_coordinates ?? "?"}, ${r.country ?? "?"}`,
        event_type: etype,
        fatalities: r.best ?? null,
        event_date: (r.date_start ?? "").slice(0, 10) || null,
        country: r.country ? NAME_TO_CODE[r.country] ?? null : null,
        notes: `${r.side_a ?? "?"} / ${r.side_b ?? "?"}`.slice(0, 280),
      },
    });
  }
  return { type: "FeatureCollection", features };
}
