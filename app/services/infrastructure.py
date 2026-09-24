"""Infrastructures stratégiques (aéroports internationaux, ports,
installations énergétiques hors nucléaire), via OpenStreetMap (Overpass
API). Limité aux éléments nommés pour ne garder que les sites notables.

Une requête unique couvrant les trois catégories dépasse le temps alloué
par les instances publiques : on les interroge séparément (chacune avec
son propre cache) puis on fusionne."""
import asyncio

from app.services.overpass import query_overpass

QUERIES = {
    "airports": (
        """[out:json][timeout:60];
(node["aeroway"="aerodrome"]["iata"]; way["aeroway"="aerodrome"]["iata"];);
out center 500;""",
        "Aéroport",
    ),
    "ports": (
        """[out:json][timeout:60];
(node["harbour"="yes"]["name"]; way["landuse"="port"]["name"];);
out center 300;""",
        "Port",
    ),
    "power": (
        """[out:json][timeout:60];
(node["power"="plant"]["name"]["plant:source"!="nuclear"]; way["power"="plant"]["name"]["plant:source"!="nuclear"];);
out center 300;""",
        "Centrale électrique",
    ),
}


async def fetch_infrastructure_sites() -> dict:
    parts = await asyncio.gather(*(
        query_overpass(q, cache_key=f"infra_{name}", name_fallback=label)
        for name, (q, label) in QUERIES.items()
    ))
    stale = [p for p in parts if p.get("stale")]
    result = {
        "type": "FeatureCollection",
        "features": [f for p in parts for f in p["features"]],
        "fetched_at": min(p["fetched_at"] for p in parts),
        "stale": bool(stale),
    }
    if stale:
        result["stale_reason"] = stale[0].get("stale_reason")
    return result
