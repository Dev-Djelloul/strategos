"""Client UCDP GED (Uppsala Conflict Data Program - Georeferenced Event
Dataset), référence académique sur la violence organisée.

L'API UCDP exige un jeton d'accès gratuit (demande par email à
ucdp@pcr.uu.se), à renseigner dans UCDP_ACCESS_TOKEN. La version du jeu
de données se règle avec UCDP_GED_VERSION (les versions "candidate"
publiées chaque mois sont plus récentes que la version annuelle).
"""
import datetime
import os
from typing import Optional

import httpx

from app.services.acled import COUNTRIES

API_URL = "https://ucdpapi.pcr.uu.se/api/gedevents"
PAGE_SIZE = 1000
MAX_PAGES = 5

# type_of_violence : 1 = conflit étatique, 2 = non étatique, 3 = violence unilatérale
VIOLENCE_TO_TYPE = {1: "offensive", 2: "offensive", 3: "casualties"}
COUNTRY_NAME_TO_CODE = {name: code for code, name in COUNTRIES.items()}


class UcdpCredentialsMissing(RuntimeError):
    pass


async def fetch_ucdp_events(event_type: str = "all", country: Optional[str] = None, days: int = 30) -> dict:
    token = os.environ.get("UCDP_ACCESS_TOKEN")
    if not token:
        raise UcdpCredentialsMissing(
            "UCDP_ACCESS_TOKEN absent : demande un jeton gratuit à ucdp@pcr.uu.se "
            "puis renseigne-le dans .env"
        )
    version = os.environ.get("UCDP_GED_VERSION", "25.1")
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    params = {"pagesize": PAGE_SIZE, "StartDate": start.isoformat(), "EndDate": end.isoformat()}
    if country in COUNTRIES:
        params["Country"] = COUNTRIES[country]

    rows: list = []
    async with httpx.AsyncClient(timeout=30.0, headers={"x-ucdp-access-token": token}) as client:
        for page in range(MAX_PAGES):
            resp = await client.get(f"{API_URL}/{version}", params={**params, "page": page})
            if resp.status_code >= 400:
                raise RuntimeError(f"UCDP a refusé la requête ({resp.status_code}): {resp.text[:200]}")
            payload = resp.json()
            rows += payload.get("Result", [])
            if page + 1 >= payload.get("TotalPages", 1):
                break

    features = []
    for r in rows:
        etype = VIOLENCE_TO_TYPE.get(r.get("type_of_violence"), "offensive")
        if event_type != "all" and etype != event_type:
            continue
        try:
            lat, lon = float(r["latitude"]), float(r["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": f'{r.get("where_coordinates") or "?"}, {r.get("country") or "?"}',
                "event_type": etype,
                "fatalities": r.get("best"),
                "event_date": (r.get("date_start") or "")[:10] or None,
                "country": COUNTRY_NAME_TO_CODE.get(r.get("country")),
                "notes": f'{r.get("side_a", "?")} / {r.get("side_b", "?")}'[:280],
            },
        })
    return {"type": "FeatureCollection", "features": features}
