"""Fusion des sources de conflits (ACLED, UCDP, GDELT) en un seul jeu
d'événements.

Un même événement réel est souvent rapporté par plusieurs sources. On
regroupe les points proches dans l'espace (< 30 km) et dans le temps
(< 3 jours) en un seul marqueur, et on en déduit un niveau de fiabilité :

- confirmed : au moins 2 sources distinctes, dont une source qualifiée
- verified  : une source qualifiée (ACLED / UCDP) seule
- press     : uniquement détecté dans la presse (GDELT), non vérifié

Chaque source qui échoue est signalée dans `sources` sans bloquer les
autres, et aucune donnée n'est jamais fabriquée.
"""
import asyncio
import datetime
import math
from typing import Optional

from app.services.acled import fetch_conflict_events
from app.services.gdelt import fetch_gdelt_events
from app.services.ucdp import fetch_ucdp_events

DISTANCE_KM = 30
DAYS_WINDOW = 3
CELL = 0.5  # degrés : taille des cases d'indexation spatiale

SOURCES = {
    "acled": {"label": "ACLED", "reliability": "verified", "fetch": fetch_conflict_events},
    "ucdp": {"label": "UCDP", "reliability": "verified", "fetch": fetch_ucdp_events},
    "gdelt": {"label": "GDELT", "reliability": "press", "fetch": fetch_gdelt_events},
}
PRIORITY = ["acled", "ucdp", "gdelt"]  # la source la plus fiable fournit le titre/type


def _km(lat1, lon1, lat2, lon2) -> float:
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(a))


def _day(date_str: Optional[str]) -> Optional[datetime.date]:
    try:
        return datetime.date.fromisoformat((date_str or "")[:10])
    except ValueError:
        return None


def _confidence(members: list) -> str:
    keys = {m["source"] for m in members}
    verified = any(SOURCES[k]["reliability"] == "verified" for k in keys)
    if verified and len(keys) >= 2:
        return "confirmed"
    return "verified" if verified else "press"


def merge_features(by_source: dict) -> list:
    """by_source : {clé_source: [features GeoJSON]} -> features fusionnées."""
    items = []
    for key in PRIORITY:
        for f in by_source.get(key, []):
            lon, lat = f["geometry"]["coordinates"]
            items.append({"source": key, "lat": lat, "lon": lon, "day": _day(f["properties"].get("event_date")), "p": f["properties"]})

    clusters: list = []
    grid: dict = {}
    for it in items:
        cx, cy = int(it["lat"] // CELL), int(it["lon"] // CELL)
        target = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ci in grid.get((cx + dx, cy + dy), []):
                    c = clusters[ci]
                    if _km(it["lat"], it["lon"], c["lat"], c["lon"]) > DISTANCE_KM:
                        continue
                    if it["day"] and c["day"] and abs((it["day"] - c["day"]).days) > DAYS_WINDOW:
                        continue
                    target = c
                    break
                if target:
                    break
            if target:
                break
        if target is None:
            target = {"lat": it["lat"], "lon": it["lon"], "day": it["day"], "members": []}
            clusters.append(target)
            grid.setdefault((cx, cy), []).append(len(clusters) - 1)
        target["members"].append(it)
        if it["day"] and (not target["day"] or it["day"] > target["day"]):
            target["day"] = it["day"]

    features = []
    for c in clusters:
        lead = c["members"][0]  # membres triés par priorité de source
        fatalities = [m["p"].get("fatalities") for m in c["members"] if isinstance(m["p"].get("fatalities"), (int, float))]
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lead["lon"], lead["lat"]]},
            "properties": {
                "name": lead["p"].get("name"),
                "event_type": lead["p"].get("event_type"),
                "event_date": c["day"].isoformat() if c["day"] else None,
                "fatalities": max(fatalities) if fatalities else None,
                "confidence": _confidence(c["members"]),
                "sources": [
                    {
                        "key": m["source"],
                        "label": SOURCES[m["source"]]["label"],
                        "reliability": SOURCES[m["source"]]["reliability"],
                        "date": m["p"].get("event_date"),
                        "count": m["p"].get("count"),
                        "url": m["p"].get("source_url"),
                        "notes": m["p"].get("notes"),
                    }
                    for m in c["members"]
                ],
            },
        })
    return features


async def fetch_conflicts(sources: list, event_type: str, country: Optional[str], days: int) -> dict:
    keys = [k for k in PRIORITY if k in sources]
    results = await asyncio.gather(
        *(SOURCES[k]["fetch"](event_type=event_type, country=country, days=days) for k in keys),
        return_exceptions=True,
    )
    by_source, status = {}, {}
    for k, r in zip(keys, results):
        if isinstance(r, Exception):
            status[k] = {"ok": False, "error": str(r) or type(r).__name__}
        else:
            by_source[k] = r["features"]
            status[k] = {"ok": True, "count": len(r["features"]), **({"meta": r["meta"]} if "meta" in r else {})}
    features = merge_features(by_source)
    return {"type": "FeatureCollection", "features": features, "sources": status}
