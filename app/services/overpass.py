"""Client pour l'API Overpass (interroge les données OpenStreetMap avec
un langage de requête dédié, Overpass QL) - gratuite, sans clé.

Les requêtes globales larges (ex: tous les sites "military=*" du monde)
peuvent être très lourdes et se faire rejeter par l'instance publique
(timeout, quota). On limite donc systématiquement aux éléments qui ont
un nom (name=*) pour ne garder que les sites notables/identifiés, et on
plafonne le nombre de résultats.
"""
import time

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
REQUEST_HEADERS = {"User-Agent": "Strategos/0.1 (projet pédagogique; contact: digitalblueskye@gmail.com)"}

_cache: dict = {}
CACHE_TTL_SECONDS = 6 * 3600


def _elements_to_geojson(elements: list, name_fallback: str) -> dict:
    features = []
    for el in elements:
        if el.get("type") == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue

        tags = el.get("tags", {})
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": tags.get("name", name_fallback),
                "type": tags.get("military") or tags.get("aeroway") or tags.get("power") or tags.get("landuse"),
                "operator": tags.get("operator"),
            },
        })
    return {"type": "FeatureCollection", "features": features}


async def query_overpass(query_ql: str, cache_key: str, name_fallback: str = "Site") -> dict:
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and cached["expires_at"] > now:
        return cached["data"]

    async with httpx.AsyncClient(timeout=30.0, headers=REQUEST_HEADERS) as client:
        response = await client.post(OVERPASS_URL, data={"data": query_ql})
        response.raise_for_status()
        payload = response.json()

    result = _elements_to_geojson(payload.get("elements", []), name_fallback)
    _cache[cache_key] = {"data": result, "expires_at": now + CACHE_TTL_SECONDS}
    return result
