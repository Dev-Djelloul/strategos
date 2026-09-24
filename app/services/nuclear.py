"""Client Wikidata pour les installations nucléaires civiles (centrales,
sites sous garanties AIEA) - API SPARQL publique, gratuite, sans
inscription. Volontairement limité aux sites civils déclarés et
documentés publiquement (pas de tentative de localiser des installations
militaires non déclarées).

Le résultat est mis en cache en mémoire (ces données changent rarement)
pour éviter de solliciter Wikidata à chaque requête.
"""
import time

import httpx

SPARQL_URL = "https://query.wikidata.org/sparql"

# Q159313 = centrale nucléaire ; P625 = coordonnées ; P17 = pays ;
# P5817 = statut opérationnel (en service, à l'arrêt, en construction...)
SPARQL_QUERY = """
SELECT ?itemLabel ?coord ?countryLabel ?statusLabel WHERE {
  ?item wdt:P31 wd:Q159313.
  ?item wdt:P625 ?coord.
  OPTIONAL { ?item wdt:P17 ?country. }
  OPTIONAL { ?item wdt:P5817 ?status. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
"""

REQUEST_HEADERS = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "Strategos/0.1 (projet pédagogique; contact: digitalblueskye@gmail.com)",
}

_cache: dict = {"data": None, "expires_at": 0}
CACHE_TTL_SECONDS = 24 * 3600


def _parse_point(coord_wkt: str):
    # Format Wikidata: "Point(lon lat)"
    try:
        inner = coord_wkt.strip().removeprefix("Point(").removesuffix(")")
        lon_str, lat_str = inner.split(" ")
        return float(lon_str), float(lat_str)
    except (ValueError, AttributeError):
        return None


async def fetch_nuclear_sites() -> dict:
    now = time.time()
    if _cache["data"] is not None and _cache["expires_at"] > now:
        return _cache["data"]

    async with httpx.AsyncClient(timeout=30.0, headers=REQUEST_HEADERS) as client:
        response = await client.get(SPARQL_URL, params={"query": SPARQL_QUERY, "format": "json"})
        response.raise_for_status()
        payload = response.json()

    features = []
    for row in payload.get("results", {}).get("bindings", []):
        coord = row.get("coord", {}).get("value")
        if not coord:
            continue
        point = _parse_point(coord)
        if not point:
            continue
        lon, lat = point
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": row.get("itemLabel", {}).get("value", "Site nucléaire"),
                "country": row.get("countryLabel", {}).get("value"),
                "status": row.get("statusLabel", {}).get("value"),
            },
        })

    result = {"type": "FeatureCollection", "features": features}
    _cache["data"] = result
    _cache["expires_at"] = now + CACHE_TTL_SECONDS
    return result
