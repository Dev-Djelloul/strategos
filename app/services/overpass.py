"""Client pour l'API Overpass (interroge les données OpenStreetMap avec
un langage de requête dédié, Overpass QL) - gratuite, sans clé.

Les requêtes globales larges (ex: tous les sites "military=*" du monde)
peuvent être très lourdes et se faire rejeter par l'instance publique
(timeout, quota). On limite donc systématiquement aux éléments qui ont
un nom (name=*) pour ne garder que les sites notables/identifiés, et on
plafonne le nombre de résultats.
"""
import httpx

from app.services.cache import cached_fetch

# Instances publiques essayées dans l'ordre (la première est souvent saturée).
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
REQUEST_HEADERS = {"User-Agent": "Strategos/0.1 (projet pedagogique; contact: digitalblueskye@gmail.com)"}

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


async def _query_mirrors(query_ql: str) -> dict:
    last_exc: Exception = RuntimeError("Overpass indisponible")
    async with httpx.AsyncClient(timeout=60.0, headers=REQUEST_HEADERS) as client:
        for url in OVERPASS_URLS:
            try:
                response = await client.post(url, data={"data": query_ql})
                response.raise_for_status()
                payload = response.json()
                # Overpass répond 200 avec 0 élément et une "remark" quand la
                # requête dépasse son temps alloué : c'est une panne, pas un
                # résultat vide.
                if "runtime error" in (payload.get("remark") or ""):
                    raise RuntimeError(payload["remark"])
                return payload
            except Exception as exc:  # noqa: BLE001
                last_exc = RuntimeError(f"{url.split('/')[2]} : {str(exc) or type(exc).__name__}")
    raise last_exc


async def query_overpass(query_ql: str, cache_key: str, name_fallback: str = "Site") -> dict:
    async def fetch() -> dict:
        payload = await _query_mirrors(query_ql)
        return _elements_to_geojson(payload.get("elements", []), name_fallback)

    return await cached_fetch(f"overpass_{cache_key}", CACHE_TTL_SECONDS, fetch)
