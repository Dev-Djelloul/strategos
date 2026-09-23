"""Client pour l'API GDELT GEO 2.0 (gratuite, sans clé) - géolocalise des
événements d'actualité récents à partir d'une requête plein texte.

GDELT n'expose pas de vraies catégories d'événements structurées (type
CAMEO) sur cette API - contrairement à la base Event Database complète.
On simule donc un "type d'événement" par des mots-clés ciblés ajoutés à la
requête plein texte. Le filtre pays utilise l'opérateur `sourcecountry:`
de GDELT, qui attend des codes FIPS 10-4 (et non ISO 3166)."""
import httpx

GDELT_GEO_URL = "https://api.gdeltproject.org/api/v2/geo/geo"

DEFAULT_QUERY = "war OR conflict OR airstrike OR ceasefire"

# Mots-clés par pseudo-catégorie d'événement (approximation, l'API GDELT
# GEO ne fournit pas de vrais codes CAMEO comme l'Event Database complète).
EVENT_TYPE_KEYWORDS = {
    "all": "war OR conflict OR airstrike OR ceasefire",
    "airstrike": "airstrike OR bombing OR bombardment",
    "ceasefire": "ceasefire OR truce OR peace talks",
    "offensive": "offensive OR advance OR incursion OR invasion",
    "protest": "protest OR unrest OR riot",
    "casualties": "killed OR casualties OR wounded",
}

# Codes pays FIPS 10-4 (format attendu par sourcecountry: sur GDELT) pour
# les zones les plus suivies. Liste volontairement restreinte pour le MVP.
COUNTRY_CODES = {
    "UP": "Ukraine",
    "RS": "Russie",
    "IS": "Israël",
    "SY": "Syrie",
    "SU": "Soudan",
    "ML": "Mali",
    "AF": "Afghanistan",
    "IR": "Iran",
    "IZ": "Irak",
    "YM": "Yémen",
}


def build_query(event_type: str = "all", country: str | None = None) -> str:
    """Construit la requête plein texte GDELT à partir des filtres UI."""
    query = EVENT_TYPE_KEYWORDS.get(event_type, EVENT_TYPE_KEYWORDS["all"])
    if country and country in COUNTRY_CODES:
        query = f"({query}) sourcecountry:{country}"
    return query


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
