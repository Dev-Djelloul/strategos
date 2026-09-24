"""Infrastructures stratégiques (aéroports internationaux, ports,
installations énergétiques hors nucléaire), via OpenStreetMap (Overpass
API). Limité aux éléments nommés pour ne garder que les sites notables."""
from app.services.overpass import query_overpass

QUERY = """
[out:json][timeout:25];
(
  node["aeroway"="aerodrome"]["iata"];
  way["aeroway"="aerodrome"]["iata"];
  node["harbour"="yes"]["name"];
  way["landuse"="port"]["name"];
  node["power"="plant"]["name"]["plant:source"!="nuclear"];
  way["power"="plant"]["name"]["plant:source"!="nuclear"];
);
out center 800;
"""


async def fetch_infrastructure_sites() -> dict:
    return await query_overpass(QUERY, cache_key="infrastructure", name_fallback="Infrastructure")
