/** Fusion des sources de conflits (ACLED, UCDP, GDELT) en un seul jeu.
 *
 * Les points proches dans l'espace (< 30 km) et le temps (< 3 jours) sont
 * regroupés en un marqueur, avec un niveau de fiabilité :
 *  - confirmed : >= 2 sources distinctes dont une qualifiée
 *  - verified  : une source qualifiée (ACLED / UCDP) seule
 *  - press     : détecté uniquement dans la presse (GDELT), non vérifié
 * Chaque source qui échoue est signalée dans `sources` sans bloquer les
 * autres ; aucune donnée n'est jamais fabriquée. */
import type { Ctx, Env, Feature, FeatureCollection, Props } from "./types.ts";
import { errMessage } from "./cache.ts";
import { fetchAcledEvents } from "./sources/acled.ts";
import { fetchUcdpEvents } from "./sources/ucdp.ts";
import { fetchGdeltEvents } from "./sources/gdelt.ts";

const DISTANCE_KM = 30;
const DAYS_WINDOW = 3;
const CELL = 0.5; // degrés : taille des cases d'indexation spatiale

export type SourceKey = "acled" | "ucdp" | "gdelt";
export const PRIORITY: SourceKey[] = ["acled", "ucdp", "gdelt"]; // la plus fiable fournit titre/type
// ACLED reste dans PRIORITY (utilisable via ?sources=acled si des identifiants
// sont un jour reconfigurés) mais n'est plus interrogé par défaut : son API
// d'événements n'est plus accessible aux adresses email personnelles.
export const DEFAULT_SOURCES: SourceKey[] = ["ucdp", "gdelt"];

export const SOURCES: Record<SourceKey, { label: string; reliability: "verified" | "press" }> = {
  acled: { label: "ACLED", reliability: "verified" },
  ucdp: { label: "UCDP", reliability: "verified" },
  gdelt: { label: "GDELT", reliability: "press" },
};

interface Item {
  source: SourceKey;
  lat: number;
  lon: number;
  day: number | null; // jours depuis l'époque
  p: Props;
}

interface Cluster {
  lat: number;
  lon: number;
  day: number | null;
  members: Item[];
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * p) / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

function toDay(date: unknown): number | null {
  const ms = Date.parse(String(date ?? "").slice(0, 10));
  return Number.isNaN(ms) ? null : Math.floor(ms / 86400000);
}

const dayToIso = (d: number) => new Date(d * 86400000).toISOString().slice(0, 10);

export function confidence(members: Item[]): "confirmed" | "verified" | "press" {
  const keys = new Set(members.map((m) => m.source));
  const verified = [...keys].some((k) => SOURCES[k].reliability === "verified");
  if (verified && keys.size >= 2) return "confirmed";
  return verified ? "verified" : "press";
}

export function mergeFeatures(bySource: Partial<Record<SourceKey, Feature[]>>): Feature[] {
  const items: Item[] = [];
  for (const key of PRIORITY) {
    for (const f of bySource[key] ?? []) {
      const [lon, lat] = f.geometry.coordinates;
      items.push({ source: key, lat, lon, day: toDay(f.properties.event_date), p: f.properties });
    }
  }

  const clusters: Cluster[] = [];
  const grid = new Map<string, number[]>();
  for (const it of items) {
    const cx = Math.floor(it.lat / CELL);
    const cy = Math.floor(it.lon / CELL);
    let target: Cluster | undefined;
    search: for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const ci of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const c = clusters[ci];
          if (haversineKm(it.lat, it.lon, c.lat, c.lon) > DISTANCE_KM) continue;
          if (it.day !== null && c.day !== null && Math.abs(it.day - c.day) > DAYS_WINDOW) continue;
          target = c;
          break search;
        }
      }
    }
    if (!target) {
      target = { lat: it.lat, lon: it.lon, day: it.day, members: [] };
      clusters.push(target);
      const gk = `${cx},${cy}`;
      grid.set(gk, [...(grid.get(gk) ?? []), clusters.length - 1]);
    }
    target.members.push(it);
    if (it.day !== null && (target.day === null || it.day > target.day)) target.day = it.day;
  }

  return clusters.map((c) => {
    const lead = c.members[0]; // membres triés par priorité de source
    const fatalities = c.members.map((m) => m.p.fatalities).filter((v): v is number => typeof v === "number");
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lead.lon, lead.lat] },
      properties: {
        name: lead.p.name,
        event_type: lead.p.event_type,
        event_date: c.day !== null ? dayToIso(c.day) : null,
        fatalities: fatalities.length ? Math.max(...fatalities) : null,
        confidence: confidence(c.members),
        sources: c.members.map((m) => ({
          key: m.source,
          label: SOURCES[m.source].label,
          reliability: SOURCES[m.source].reliability,
          date: m.p.event_date ?? null,
          count: m.p.count ?? null,
          url: m.p.source_url ?? null,
          notes: m.p.notes ?? null,
        })),
      },
    };
  });
}

export interface SourceStatus {
  ok: boolean;
  count?: number;
  error?: string;
  meta?: unknown;
}

export async function fetchConflicts(
  env: Env,
  ctx: Ctx,
  opts: { sources: SourceKey[]; eventType: string; country: string | null; days: number },
): Promise<FeatureCollection> {
  const keys = PRIORITY.filter((k) => opts.sources.includes(k));
  const q = { eventType: opts.eventType, country: opts.country, days: opts.days };
  const fetchers: Record<SourceKey, () => Promise<FeatureCollection>> = {
    acled: () => fetchAcledEvents(env, q),
    ucdp: () => fetchUcdpEvents(env, ctx, q),
    gdelt: () => fetchGdeltEvents(env, ctx, q),
  };
  const results = await Promise.allSettled(keys.map((k) => fetchers[k]()));

  const bySource: Partial<Record<SourceKey, Feature[]>> = {};
  const status: Partial<Record<SourceKey, SourceStatus>> = {};
  keys.forEach((k, i) => {
    const r = results[i];
    if (r.status === "rejected") {
      status[k] = { ok: false, error: errMessage(r.reason) };
    } else {
      bySource[k] = r.value.features;
      status[k] = { ok: true, count: r.value.features.length, ...(r.value.meta ? { meta: r.value.meta } : {}) };
    }
  });
  return { type: "FeatureCollection", features: mergeFeatures(bySource), sources: status };
}
