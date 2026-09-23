"""Client pour l'API GDELT GEO 2.0 (gratuite, sans clé) - géolocalise des
événements d'actualité récents à partir d'une requête plein texte."""
import httpx

GDELT_GEO_URL = "https://api.gdeltproject.org/api/v2/geo/geo"

DEFAULT_QUERY = "war OR conflict OR airstrike OR ceasefire"


async def fetch_conflict_events(query: str = DEFAULT_QUERY, timespan: str = "24h") -> dict:
    """Retourne un GeoJSON FeatureCollection d'événements géolocalisés.

    timespan accepte le format GDELT: "24h", "7d", "1w", etc.
    """
    params = {
        "query": query,
        "format": "geojson",
        "timespan": timespan,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(GDELT_GEO_URL, params=params)
        response.raise_for_status()
        return response.json()
