/** Abonnements et envoi des notifications Web Push (nouveaux événements).
 *
 * Les souscriptions sont stockées dans le même namespace KV que le cache des
 * couches (préfixe "push_sub:", pas de TTL : elles ne sont supprimées que sur
 * désabonnement explicite ou détection d'un abonnement mort — 404/410 — lors
 * d'un envoi). L'état "derniers événements vus" (préfixe unique "push_seen")
 * permet au cron de ne notifier que les événements réellement nouveaux depuis
 * son dernier passage, comme le fait le fil "Nouveaux événements" côté client
 * (voir app.js, fonction eventKey — même logique, dupliquée ici : le client
 * tourne en JS statique, pas dans ce module TypeScript). */
import type { Ctx, Env, Feature } from "./types.ts";
import { DEFAULT_SOURCES, fetchConflicts } from "./conflicts.ts";
import { errMessage } from "./cache.ts";
import { sendWebPush } from "./webpush.ts";
import type { PushSubscription } from "./webpush.ts";

const SEEN_KEY = "push_seen";
const MAX_SEEN = 2000;
const VAPID_SUBJECT = "mailto:digitalblueskye@gmail.com";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const eventKey = (f: Feature): string => {
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties;
  return `${p.event_date}|${p.event_type}|${lon.toFixed(2)}|${lat.toFixed(2)}`;
};

const subKey = async (endpoint: string): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return `push_sub:${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
};

function isValidSubscription(body: unknown): body is PushSubscription {
  const b = body as Partial<PushSubscription> | null;
  return !!b && typeof b.endpoint === "string" && !!b.keys && typeof b.keys.p256dh === "string" && typeof b.keys.auth === "string";
}

export async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ detail: "JSON invalide" }, 400);
  }
  if (!isValidSubscription(body)) return json({ detail: "Souscription invalide (endpoint/keys.p256dh/keys.auth requis)" }, 400);
  await env.CACHE.put(await subKey(body.endpoint), JSON.stringify(body));
  return json({ ok: true });
}

export async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ detail: "JSON invalide" }, 400);
  }
  const endpoint = (body as { endpoint?: string })?.endpoint;
  if (typeof endpoint !== "string") return json({ detail: "endpoint requis" }, 400);
  await env.CACHE.delete(await subKey(endpoint));
  return json({ ok: true });
}

/** Notifie les abonnés des événements apparus depuis le dernier passage du
 * cron. Premier passage (aucun état "seen" enregistré) : initialise le suivi
 * sans notifier, pour ne pas envoyer une rafale sur tout l'historique des
 * dernières 24h dès l'activation de la fonctionnalité. */
export async function checkAndNotify(env: Env, ctx: Ctx): Promise<{ notified: number; newEvents: number }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { notified: 0, newEvents: 0 };

  const data = await fetchConflicts(env, ctx, { sources: DEFAULT_SOURCES, eventType: "all", country: null, days: 1 });
  const keys = data.features.map(eventKey);

  const seenRaw = await env.CACHE.get<string[]>(SEEN_KEY, "json");
  const seen = new Set(seenRaw ?? []);
  const isFirstRun = seenRaw === null;
  const fresh = isFirstRun ? [] : data.features.filter((f) => !seen.has(eventKey(f)));

  keys.forEach((k) => seen.add(k));
  const trimmed = [...seen].slice(-MAX_SEEN);
  await env.CACHE.put(SEEN_KEY, JSON.stringify(trimmed));

  if (!fresh.length) return { notified: 0, newEvents: 0 };

  const lead = fresh[0].properties;
  const payload = {
    title: fresh.length === 1 ? "Strategos — nouvel événement" : `Strategos — ${fresh.length} nouveaux événements`,
    body: lead.name ? `${lead.name} — ${lead.event_type ?? ""}`.trim() : "Voir le globe pour les détails.",
    url: "/",
  };

  const list = await env.CACHE.list({ prefix: "push_sub:" });
  let notified = 0;
  await Promise.allSettled(
    list.keys.map(async (k) => {
      const sub = await env.CACHE.get<PushSubscription>(k.name, "json");
      if (!sub) return;
      try {
        const result = await sendWebPush(sub, payload, env.VAPID_PUBLIC_KEY as string, env.VAPID_PRIVATE_KEY as string, VAPID_SUBJECT);
        if (result.gone) await env.CACHE.delete(k.name);
        else if (result.ok) notified++;
        else console.log(`push ${k.name}: HTTP ${result.status} — ${result.detail}`);
      } catch (e) {
        console.log(`push ${k.name}: échec — ${errMessage(e)}`);
      }
    }),
  );
  return { notified, newEvents: fresh.length };
}
