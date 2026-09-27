/** Cache KV avec repli sur la dernière donnée RÉELLE connue.
 *
 * Une donnée fraîche est servie directement ; sinon on actualise en
 * arrière-plan (une seule fois à la fois par clé). Avec un ancien cache on
 * le sert tout de suite, marqué périmé ; sans cache on attend un court
 * instant puis on répond "premier chargement en cours". Jamais de donnée
 * fabriquée. */
import type { Ctx, Env, FeatureCollection } from "./types.ts";

const RETRY_DELAYS_MS = [0, 1500, 4000];

export class WarmingUp extends Error {}

interface Entry {
  fetched_at: string;
  data: FeatureCollection;
}

// Dans un même isolate : dédoublonne les actualisations et retient la
// dernière erreur pour l'afficher sur une donnée périmée.
const inflight = new Map<string, Promise<Entry>>();
const lastError = new Map<string, string>();

const kvKey = (key: string) => `layer:${key}`;

export const errMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)) || (e instanceof Error ? e.name : "erreur");

async function refresh(env: Env, key: string, fetchFn: () => Promise<FeatureCollection>): Promise<Entry> {
  let last: unknown = new Error("source indisponible");
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const entry: Entry = { fetched_at: new Date().toISOString(), data: await fetchFn() };
      await env.CACHE.put(kvKey(key), JSON.stringify(entry));
      lastError.delete(key);
      return entry;
    } catch (e) {
      last = e;
    }
  }
  lastError.set(key, errMessage(last));
  throw last;
}

function startRefresh(env: Env, key: string, fetchFn: () => Promise<FeatureCollection>): Promise<Entry> {
  let p = inflight.get(key);
  if (!p) {
    p = refresh(env, key, fetchFn).finally(() => inflight.delete(key));
    p.catch(() => {}); // l'erreur est reportée via lastError / l'appelant
    inflight.set(key, p);
  }
  return p;
}

export async function cachedFetch(
  env: Env,
  ctx: Ctx,
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<FeatureCollection>,
  waitMs = 8000,
): Promise<FeatureCollection> {
  const entry = await env.CACHE.get<Entry>(kvKey(key), "json");
  const ageSeconds = entry ? (Date.now() - Date.parse(entry.fetched_at)) / 1000 : Infinity;
  if (entry && ageSeconds < ttlSeconds) {
    return { ...entry.data, fetched_at: entry.fetched_at, stale: false };
  }

  const pending = startRefresh(env, key, fetchFn);
  ctx.waitUntil(pending.catch(() => {}));

  if (entry) {
    return {
      ...entry.data,
      fetched_at: entry.fetched_at,
      stale: true,
      stale_reason: lastError.get(key) ?? "actualisation en cours",
    };
  }

  const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), waitMs));
  const result = await Promise.race([pending, timeout]);
  if (result === "timeout") {
    throw new WarmingUp("premier chargement en cours (source lente), réessaie dans quelques instants");
  }
  return { ...result.data, fetched_at: result.fetched_at, stale: false };
}
