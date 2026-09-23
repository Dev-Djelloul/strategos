"""Client pour l'API GDELT GEO 2.0 (gratuite, sans clé) - géolocalise des
événements d'actualité récents à partir d'une requête plein texte.

GDELT n'expose pas de vraies catégories d'événements structurées (type
CAMEO) sur cette API - contrairement à la base Event Database complète.
On simule donc un "type d'événement" par des mots-clés ciblés ajoutés à la
requête plein texte. Le filtre pays utilise l'opérateur `sourcecountry:`
de GDELT, qui attend des codes FIPS 10-4 (et non ISO 3166)."""
from typing import Optional

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


def build_query(event_type: str = "all", country: Optional[str] = None) -> str:
    """Construit la requête plein texte GDELT à partir des filtres UI."""
    query = EVENT_TYPE_KEYWORDS.get(event_type, EVENT_TYPE_KEYWORDS["all"])
    if country and country in COUNTRY_CODES:
        query = f"({query}) sourcecountry:{country}"
    return query


# Un navigateur usuel envoie toujours un User-Agent ; certains WAF/CDN
# renvoient une 404 générique aux requêtes qui en sont dépourvues (comme
# le client HTTP par défaut d'httpx), ce qui ressemble à une mauvaise URL
# alors que ce n'en est pas une.
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; Strategos/0.1)"}


async def fetch_conflict_events(query: str = DEFAULT_QUERY, timespan_minutes: int = 1440) -> dict:
    """Retourne un GeoJSON FeatureCollection d'événements géolocalisés.

    L'API GEO 2.0 de GDELT n'accepte le timespan qu'en minutes, de 15 à
    1440 (24h max) - contrairement à l'API DOC 2.0 qui accepte "7d", "1w",
    etc. `mode=PointData` est requis pour obtenir des points géolocalisés
    individuels (les autres modes agrègent par pays/région).
    """
    params = {
        "query": query,
        "format": "geojson",
        "mode": "PointData",
        "timespan": max(15, min(timespan_minutes, 1440)),
    }
    async with httpx.AsyncClient(timeout=15.0, headers=REQUEST_HEADERS) as client:
        response = await client.get(GDELT_GEO_URL, params=params)
        response.raise_for_status()
        return response.json()
