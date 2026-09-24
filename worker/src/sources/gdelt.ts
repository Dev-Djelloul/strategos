/** GDELT 2.0 : un fichier d'événements de la presse mondiale toutes les
 * 15 minutes (sans clé). Ce ne sont PAS des données vérifiées : on ne garde
 * que la violence matérielle (racines CAMEO 18-20) localisée à une
 * ville/région et rapportée par >= 2 sources.
 *
 * Contrairement à la version Python (qui relisait jusqu'à 200 fichiers à
 * chaque requête), la collecte est incrémentale : chaque nouveau fichier est
 * filtré, agrégé par lieu/type et ajouté à un blob KV par jour ; une requête
 * ne lit que quelques blobs. L'historique commence donc au début de la
 * collecte (cron toutes les 15 min). */
import type { Ctx, Env, Feature, FeatureCollection } from "../types.ts";
import { unzipFirstFile } from "../zip.ts";
import { WarmingUp, errMessage } from "../cache.ts";

const BASE_URL = "https://data.gdeltproject.org/gdeltv2";
const MAX_FEATURES = 800;
const MAX_GROUPS_PER_DAY = 1500;
const MIN_SOURCES = 2;
const BACKFILL_HOURS = 24;
const DAY_TTL_SECONDS = 100 * 86400;
const FRESH_MINUTES = 25;

// Colonnes du fichier export GDELT 2.0 (index 0-based).
const C = { DATE: 1, CODE: 26, ROOT: 28, MENTIONS: 31, SOURCES: 32, GEO_TYPE: 51, GEO_NAME: 52, COUNTRY: 53, LAT: 56, LON: 57, URL: 60 };
const N_COLUMNS = 61;

const ROOT_TO_TYPE: Record<string, string> = { "18": "casualties", "19": "offensive", "20": "casualties" };
const AERIAL_CODE = "195"; // "employ aerial weapons"

// Pays suivis (code FIPS utilisé par GDELT -> code de l'app).
const FIPS_TO_APP: Record<string, string> = {
  UP: "UA", RS: "RU", IS: "IL", SY: "SY", SU: "SD", ML: "ML", AF: "AF", IR: "IR", IZ: "IQ", YM: "YE",
};

export interface Group {
  name: string;
  count: number;
  date: string; // YYYYMMDD
  url: string;
  country: string | null;
  lat: number;
  lon: number;
  etype: string;
}

interface DayBlob {
  stamps: string[];
  groups: Record<string, Group>;
}

/** Filtre + agrège les lignes d'un fichier export (texte TSV) dans `groups`. */
export function aggregateExport(text: string, groups: Record<string, Group>): void {
  for (const line of text.split("\n")) {
    if (!line) continue;
    const r = line.split("\t");
    if (r.length < N_COLUMNS) continue;
    const root = r[C.ROOT];
    if (!(root in ROOT_TO_TYPE)) continue;
    const lat = parseFloat(r[C.LAT]);
    const lon = parseFloat(r[C.LON]);
    const sources = parseInt(r[C.SOURCES], 10);
    const mentions = parseInt(r[C.MENTIONS], 10);
    if ([lat, lon, sources, mentions].some(Number.isNaN)) continue;
    // 1 = pays entier (centroïde), trop imprécis pour un point sur le globe.
    if (r[C.GEO_TYPE] === "" || r[C.GEO_TYPE] === "1" || sources < MIN_SOURCES) continue;

    const etype = r[C.CODE].startsWith(AERIAL_CODE) ? "airstrike" : ROOT_TO_TYPE[root];
    const key = `${lat.toFixed(2)},${lon.toFixed(2)},${etype}`;
    const date = r[C.DATE];
    const g = groups[key];
    if (!g) {
      groups[key] = { name: r[C.GEO_NAME], count: mentions, date, url: r[C.URL], country: FIPS_TO_APP[r[C.COUNTRY]] ?? null, lat, lon, etype };
    } else {
      g.count += mentions;
      if (date > g.date) {
        g.date = date;
        g.url = r[C.URL];
      }
    }
  }
}

const dayKey = (yyyymmdd: string) => `gdelt:day:${yyyymmdd}`;

/** Horodatages (YYYYMMDDHHMMSS) des fichiers 15 min sur les dernières heures,
 * du plus récent au plus ancien (le dernier fichier est ignoré : il peut ne
 * pas être encore publié). */
export function recentStamps(now: Date, hours: number): string[] {
  const t = new Date(now);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() - (t.getUTCMinutes() % 15) - 15);
  const out: string[] = [];
  for (let i = 0; i < hours * 4; i++) {
    out.push(new Date(t.getTime() - i * 15 * 60000).toISOString().replace(/[-:T]/g, "").slice(0, 12) + "00");
  }
  return out;
}

let ingestRunning: Promise<number> | null = null;

/** Télécharge les fichiers manquants (au plus `limit`, les plus récents
 * d'abord) et met à jour les blobs journaliers. Retourne le nombre ingéré. */
export function ingestGdelt(env: Env, limit = 20, now = new Date()): Promise<number> {
  ingestRunning ??= doIngest(env, limit, now).finally(() => (ingestRunning = null));
  return ingestRunning;
}

async function doIngest(env: Env, limit: number, now: Date): Promise<number> {
  const stamps = recentStamps(now, BACKFILL_HOURS);
  const days = [...new Set(stamps.map((s) => s.slice(0, 8)))];
  const blobs = new Map<string, DayBlob>();
  for (const d of days) {
    blobs.set(d, (await env.CACHE.get<DayBlob>(dayKey(d), "json")) ?? { stamps: [], groups: {} });
  }
  const missing = stamps.filter((s) => !blobs.get(s.slice(0, 8))!.stamps.includes(s)).slice(0, limit);
  if (!missing.length) return 0;

  // Téléchargements en parallèle (par lots), traitement séquentiel.
  const fetched: { stamp: string; text: string | null }[] = [];
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    fetched.push(
      ...(await Promise.all(
        batch.map(async (stamp) => {
          const res = await fetch(`${BASE_URL}/${stamp}.export.CSV.zip`);
          if (res.status === 404) return { stamp, text: null }; // absent chez GDELT : on le marque traité
          if (!res.ok) throw new Error(`GDELT ${stamp} : HTTP ${res.status}`);
          return { stamp, text: await unzipFirstFile(new Uint8Array(await res.arrayBuffer())) };
        }),
      )),
    );
  }

  let done = 0;
  for (const { stamp, text } of fetched) {
    const blob = blobs.get(stamp.slice(0, 8))!;
    if (text) aggregateExport(text, blob.groups);
    blob.stamps.push(stamp);
    done++;
  }
  for (const [d, blob] of blobs) {
    // Borne la taille du blob : on garde les groupes les plus cités.
    const entries = Object.entries(blob.groups);
    if (entries.length > MAX_GROUPS_PER_DAY) {
      blob.groups = Object.fromEntries(entries.sort((a, b) => b[1].count - a[1].count).slice(0, MAX_GROUPS_PER_DAY));
    }
    await env.CACHE.put(dayKey(d), JSON.stringify(blob), { expirationTtl: DAY_TTL_SECONDS });
  }
  return done;
}

export async function fetchGdeltEvents(
  env: Env,
  ctx: Ctx,
  opts: { eventType: string; country: string | null; days: number },
): Promise<FeatureCollection> {
  const now = new Date();
  const dayStrings: string[] = [];
  for (let i = 0; i <= opts.days; i++) {
    dayStrings.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10).replaceAll("-", ""));
  }
  let blobs = await Promise.all(dayStrings.map((d) => env.CACHE.get<DayBlob>(dayKey(d), "json")));

  const newest = blobs
    .flatMap((b) => b?.stamps ?? [])
    .sort()
    .at(-1);
  const newestMs = newest
    ? Date.UTC(+newest.slice(0, 4), +newest.slice(4, 6) - 1, +newest.slice(6, 8), +newest.slice(8, 10), +newest.slice(10, 12))
    : 0;

  if (!newest) {
    // Première utilisation : on collecte les fichiers les plus récents tout de suite.
    try {
      await ingestGdelt(env, 40, now);
    } catch (e) {
      throw new Error(`aucun fichier GDELT récupéré (${errMessage(e)})`);
    }
    blobs = await Promise.all(dayStrings.map((d) => env.CACHE.get<DayBlob>(dayKey(d), "json")));
    if (!blobs.some((b) => b?.stamps.length)) throw new WarmingUp("collecte GDELT en cours, réessaie dans quelques instants");
  } else if (now.getTime() - newestMs > FRESH_MINUTES * 60000) {
    ctx.waitUntil(ingestGdelt(env, 20, now).catch(() => {}));
  }

  // Fusion des jours de la fenêtre.
  const merged = new Map<string, Group>();
  let files = 0;
  const cutoff = new Date(now.getTime() - opts.days * 86400000).toISOString().slice(0, 10).replaceAll("-", "");
  blobs.forEach((blob, i) => {
    if (!blob) return;
    files += blob.stamps.length;
    for (const [key, g] of Object.entries(blob.groups)) {
      if (g.date < cutoff) continue;
      if (opts.eventType !== "all" && g.etype !== opts.eventType) continue;
      if (opts.country && g.country !== opts.country) continue;
      const m = merged.get(key);
      if (!m) merged.set(key, { ...g });
      else {
        m.count += g.count;
        if (g.date > m.date) {
          m.date = g.date;
          m.url = g.url;
        }
      }
    }
  });

  // Premier jour pour lequel une collecte existe (le plus ancien blob non vide).
  const coverageFrom = dayStrings.filter((_, i) => blobs[i]?.stamps.length).sort()[0] ?? null;

  const features: Feature[] = [...merged.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_FEATURES)
    .map((g) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [g.lon, g.lat] },
      properties: {
        name: g.name,
        event_type: g.etype,
        event_date: `${g.date.slice(0, 4)}-${g.date.slice(4, 6)}-${g.date.slice(6, 8)}`,
        count: g.count,
        country: g.country,
        source_url: g.url,
        notes: "Événement détecté automatiquement dans la presse (GDELT), non vérifié.",
      },
    }));

  return {
    type: "FeatureCollection",
    features,
    meta: {
      files,
      sampled: false,
      // La collecte étant incrémentale, la fenêtre peut être plus courte que demandée.
      coverage_from: coverageFrom ? `${coverageFrom.slice(0, 4)}-${coverageFrom.slice(4, 6)}-${coverageFrom.slice(6, 8)}` : null,
    },
  };
}
