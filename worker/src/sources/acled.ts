/** Client ACLED : authentification OAuth (email/mot de passe -> jeton
 * temporaire), jeton gardé en mémoire de l'isolate. Identifiants dans les
 * secrets du Worker (ACLED_EMAIL, ACLED_PASSWORD), jamais en dur. */
import type { Env, Feature, FeatureCollection } from "../types.ts";
import { errMessage } from "../cache.ts";

const OAUTH_TOKEN_URL = "https://acleddata.com/oauth/token";
const ACLED_READ_URL = "https://acleddata.com/api/acled/read";

export const EVENT_TYPE_MAP: Record<string, string | null> = {
  all: null,
  airstrike: "Explosions/Remote violence",
  offensive: "Battles",
  protest: "Protests",
  casualties: "Violence against civilians",
  ceasefire: "Strategic developments",
};

export const COUNTRIES: Record<string, string> = {
  UA: "Ukraine", RU: "Russia", IL: "Israel", SY: "Syria", SD: "Sudan",
  ML: "Mali", AF: "Afghanistan", IR: "Iran", IQ: "Iraq", YE: "Yemen",
};

// Cadres [ouest, sud, est, nord] pour cadrer la caméra et limiter l'affichage.
export const COUNTRY_BOUNDS: Record<string, [number, number, number, number]> = {
  UA: [22.1, 44.3, 40.3, 52.4],
  RU: [19.0, 41.0, 180.0, 82.0],
  IL: [34.2, 29.4, 35.9, 33.4],
  SY: [35.7, 32.3, 42.4, 37.3],
  SD: [21.8, 8.7, 38.6, 22.2],
  ML: [-12.3, 10.1, 4.3, 25.0],
  AF: [60.5, 29.4, 74.9, 38.5],
  IR: [44.0, 25.0, 63.4, 39.8],
  IQ: [38.8, 29.1, 48.6, 37.4],
  YE: [42.5, 12.1, 54.5, 19.0],
};

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now() / 1000;
  if (tokenCache && tokenCache.expiresAt > now + 30) return tokenCache.token;

  if (!env.ACLED_EMAIL || !env.ACLED_PASSWORD) {
    throw new Error(
      "ACLED_EMAIL / ACLED_PASSWORD absents des secrets du Worker (wrangler secret put ACLED_EMAIL). " +
        "Voir README, section ACLED.",
    );
  }
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      username: env.ACLED_EMAIL,
      password: env.ACLED_PASSWORD,
      grant_type: "password",
      client_id: "acled",
    }),
  });
  if (!res.ok) throw new Error(`Authentification ACLED refusée (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const payload = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Réponse OAuth ACLED sans access_token.");
  tokenCache = { token: payload.access_token, expiresAt: now + (payload.expires_in ?? 3600) };
  return payload.access_token;
}

export async function fetchAcledEvents(
  env: Env,
  opts: { eventType: string; country: string | null; days: number },
): Promise<FeatureCollection> {
  const token = await getAccessToken(env);
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(1, opts.days) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    event_date: `${iso(start)}|${iso(end)}`,
    event_date_where: "BETWEEN",
    limit: "500",
  });
  const acledType = EVENT_TYPE_MAP[opts.eventType];
  if (acledType) params.set("event_type", acledType);
  if (opts.country && COUNTRIES[opts.country]) params.set("country", COUNTRIES[opts.country]);

  const res = await fetch(`${ACLED_READ_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const hint =
      res.status === 403
        ? " — accès API non accordé : ACLED ne l'ouvre plus aux adresses email personnelles " +
          "(niveau Open = données agrégées seulement). Il faut une adresse académique ou institutionnelle."
        : "";
    throw new Error(`ACLED a refusé la requête (${res.status}): ${(await res.text()).slice(0, 200)}${hint}`);
  }
  const payload = (await res.json()) as { success?: boolean; data?: Record<string, string>[] };
  if (payload.success === false) throw new Error(`Réponse ACLED en échec: ${errMessage(JSON.stringify(payload))}`);

  const features: Feature[] = [];
  for (const row of payload.data ?? []) {
    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        name: `${row.location ?? "?"}, ${row.country ?? "?"}`,
        event_type: Object.entries(EVENT_TYPE_MAP).find(([, v]) => v === row.event_type)?.[0] ?? "offensive",
        fatalities: row.fatalities !== undefined ? Number(row.fatalities) : null,
        event_date: row.event_date,
        notes: (row.notes ?? "").slice(0, 280),
      },
    });
  }
  return { type: "FeatureCollection", features };
}
