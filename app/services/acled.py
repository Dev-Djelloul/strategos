"""Client pour l'API ACLED (Armed Conflict Location & Event Data).

Contrairement à GDELT, ACLED exige une authentification OAuth par
email/mot de passe (pas de simple clé en paramètre d'URL) : on échange
ces identifiants contre un jeton d'accès temporaire (24h), qu'on met en
cache en mémoire pour éviter de se ré-authentifier à chaque requête.

Identifiants attendus dans les variables d'environnement ACLED_EMAIL et
ACLED_PASSWORD (voir .env.example) - jamais en dur dans le code, jamais
commités.
"""
import os
import time
from typing import Optional

import httpx

OAUTH_TOKEN_URL = "https://acleddata.com/oauth/token"
ACLED_READ_URL = "https://acleddata.com/api/acled/read"
OAUTH_CLIENT_ID = "acled"

# Catégories réelles d'ACLED (contrairement à GDELT, ce sont de vrais
# codes structurés, pas une approximation par mots-clés).
EVENT_TYPE_MAP = {
    "all": None,
    "airstrike": "Explosions/Remote violence",
    "offensive": "Battles",
    "protest": "Protests",
    "casualties": "Violence against civilians",
    "ceasefire": "Strategic developments",
}

COUNTRIES = {
    "UA": "Ukraine",
    "RU": "Russia",
    "IL": "Israel",
    "SY": "Syria",
    "SD": "Sudan",
    "ML": "Mali",
    "AF": "Afghanistan",
    "IR": "Iran",
    "IQ": "Iraq",
    "YE": "Yemen",
}


class AcledCredentialsMissing(RuntimeError):
    """Levée quand ACLED_EMAIL / ACLED_PASSWORD ne sont pas configurés."""


class AcledAuthError(RuntimeError):
    """Levée quand l'authentification OAuth ACLED échoue."""


_token_cache: dict = {"access_token": None, "expires_at": 0}


async def _get_access_token() -> str:
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 30:
        return _token_cache["access_token"]

    email = os.environ.get("ACLED_EMAIL")
    password = os.environ.get("ACLED_PASSWORD")
    if not email or not password:
        raise AcledCredentialsMissing(
            "ACLED_EMAIL / ACLED_PASSWORD absents de l'environnement. "
            "Crée un compte gratuit sur https://acleddata.com/myacled "
            "puis renseigne-les dans un fichier .env (voir .env.example)."
        )

    data = {
        "username": email,
        "password": password,
        "grant_type": "password",
        "client_id": OAUTH_CLIENT_ID,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(OAUTH_TOKEN_URL, data=data)
        if response.status_code != 200:
            raise AcledAuthError(f"Authentification ACLED refusée ({response.status_code}): {response.text[:200]}")
        payload = response.json()

    token = payload.get("access_token")
    expires_in = payload.get("expires_in", 3600)
    if not token:
        raise AcledAuthError("Réponse OAuth ACLED sans access_token.")

    _token_cache["access_token"] = token
    _token_cache["expires_at"] = now + expires_in
    return token


def _to_geojson(rows: list) -> dict:
    features = []
    for row in rows:
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": f'{row.get("location", "?")}, {row.get("country", "?")}',
                "event_type": row.get("event_type"),
                "fatalities": row.get("fatalities"),
                "event_date": row.get("event_date"),
                "notes": (row.get("notes") or "")[:280],
            },
        })
    return {"type": "FeatureCollection", "features": features}


async def fetch_conflict_events(
    event_type: str = "all",
    country: Optional[str] = None,
    days: int = 1,
    limit: int = 500,
) -> dict:
    """Interroge l'endpoint ACLED /acled/read et retourne un GeoJSON."""
    token = await _get_access_token()

    import datetime

    end = datetime.date.today()
    start = end - datetime.timedelta(days=max(1, days))

    params = {
        "event_date": f"{start.isoformat()}|{end.isoformat()}",
        "event_date_where": "BETWEEN",
        "limit": limit,
    }

    acled_event_type = EVENT_TYPE_MAP.get(event_type)
    if acled_event_type:
        params["event_type"] = acled_event_type

    if country and country in COUNTRIES:
        params["country"] = COUNTRIES[country]

    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
        response = await client.get(ACLED_READ_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    if not payload.get("success", True):
        raise RuntimeError(f"Réponse ACLED en échec: {payload}")

    return _to_geojson(payload.get("data", []))
