"""Bases militaires connues et nommées, via OpenStreetMap (Overpass API).
Limité aux éléments portant un tag `name` (filtre le bruit des zones
militaires non identifiées/anonymes) - données librement contribuées à
OSM, déjà publiques."""
from app.services.overpass import query_overpass

QUERY = """
[out:json][timeout:25];
(
  node["military"]["name"];
  way["military"]["name"];
  relation["military"]["name"];
);
out center 400;
"""


async def fetch_military_sites() -> dict:
    return await query_overpass(QUERY, cache_key="military", name_fallback="Site militaire")
