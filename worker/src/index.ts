/** Worker Strategos : API JSON (conflits, couches de contexte), page
 * Méthodologie et configuration front. Les fichiers statiques (globe, JS,
 * CSS) sont servis par les assets Cloudflare, sans passer par ce code. */
import type { Ctx, Env, FeatureCollection } from "./types.ts";
import { WarmingUp, errMessage } from "./cache.ts";
import { COUNTRIES, COUNTRY_BOUNDS, EVENT_TYPE_MAP, fetchAcledEvents } from "./sources/acled.ts";
import { fetchUcdpEvents } from "./sources/ucdp.ts";
import { fetchGdeltEvents, ingestGdelt } from "./sources/gdelt.ts";
import { fetchNuclearSites } from "./sources/nuclear.ts";
import { fetchMilitarySites } from "./sources/military.ts";
import { fetchInfrastructureSites } from "./sources/infrastructure.ts";
import { PRIORITY, fetchConflicts } from "./conflicts.ts";
import type { SourceKey } from "./conflicts.ts";
import { renderMethodology } from "./methodology.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** Sert une couche avec des données réelles uniquement : en cas d'échec de
 * la source, erreur 503 explicite plutôt que des données fabriquées. */
async function layerResponse(sourceName: string, fn: () => Promise<FeatureCollection>): Promise<Response> {
  try {
    return json({ ...(await fn()), source: sourceName });
  } catch (e) {
    return json({ detail: `${sourceName} : ${errMessage(e)}` }, 503);
  }
}

function parseQuery(url: URL, defaultDays: number, maxDays = 90) {
  const days = Math.min(maxDays, Math.max(1, parseInt(url.searchParams.get("days") ?? "", 10) || defaultDays));
  const eventType = url.searchParams.get("event_type") ?? "all";
  const country = url.searchParams.get("country") || null;
  return { days, eventType, country };
}

async function handleApi(url: URL, env: Env, ctx: Ctx): Promise<Response> {
  switch (url.pathname) {
    case "/api/filters":
      return json({
        event_types: Object.keys(EVENT_TYPE_MAP),
        countries: Object.entries(COUNTRIES).map(([code, name]) => ({ code, name, bbox: COUNTRY_BOUNDS[code] ?? null })),
      });

    case "/api/conflicts": {
      const q = parseQuery(url, 1);
      const wanted = (url.searchParams.get("sources") ?? PRIORITY.join(","))
        .split(",")
        .filter((s): s is SourceKey => (PRIORITY as string[]).includes(s));
      return json(await fetchConflicts(env, ctx, { ...q, sources: wanted }));
    }

    case "/api/events":
      return layerResponse("acled", () => fetchAcledEvents(env, parseQuery(url, 1)));
    case "/api/ucdp-events":
      return layerResponse("ucdp", () => fetchUcdpEvents(env, parseQuery(url, 30)));
    case "/api/gdelt-events":
      return layerResponse("gdelt", () => fetchGdeltEvents(env, ctx, parseQuery(url, 1)));

    case "/api/nuclear-sites":
      return layerResponse("wikidata", () => fetchNuclearSites(env, ctx));
    case "/api/military-sites":
      return layerResponse("overpass", () => fetchMilitarySites(env, ctx));
    case "/api/infrastructure-sites":
      return layerResponse("overpass", () => fetchInfrastructureSites(env, ctx));
  }
  return json({ detail: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/config.js") {
        // Token Cesium Ion injecté côté page (jeton public de type navigateur, restreint côté Cesium).
        return new Response(`window.CESIUM_ION_TOKEN = ${JSON.stringify(env.CESIUM_ION_TOKEN ?? "")};\n`, {
          headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" },
        });
      }
      if (url.pathname === "/methodologie") {
        return new Response(renderMethodology(env), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }
      if (url.pathname.startsWith("/api/")) return await handleApi(url, env, ctx);
    } catch (e) {
      const status = e instanceof WarmingUp ? 503 : 500;
      return json({ detail: errMessage(e) }, status);
    }
    return env.ASSETS.fetch(request);
  },

  /** Cron (toutes les 15 min) : collecte GDELT et préchauffage des couches lentes. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Promise.allSettled([
        ingestGdelt(env, 30),
        fetchNuclearSites(env, ctx).catch(() => {}),
        fetchMilitarySites(env, ctx).catch(() => {}),
        fetchInfrastructureSites(env, ctx).catch(() => {}),
      ]),
    );
  },
} satisfies ExportedHandler<Env>;
