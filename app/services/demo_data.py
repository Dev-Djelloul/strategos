"""Jeu de données factice utilisé quand GDELT est inaccessible (réseau
restreint) ou pour développer/démontrer l'UI sans dépendance externe.
Chaque événement porte un pays (code FIPS, cf. gdelt.COUNTRY_CODES) et un
type pour que les filtres fonctionnent aussi en mode démo."""

from typing import Optional

DEMO_EVENTS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [37.5, 47.1]},
            "properties": {
                "name": "Zaporijjia, Ukraine (démo)",
                "count": 42,
                "country": "UP",
                "event_type": "airstrike",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [36.3, 33.5]},
            "properties": {
                "name": "Damas, Syrie (démo)",
                "count": 18,
                "country": "SY",
                "event_type": "offensive",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [34.3, 31.5]},
            "properties": {
                "name": "Gaza (démo)",
                "count": 67,
                "country": "IS",
                "event_type": "casualties",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [45.0, 15.6]},
            "properties": {
                "name": "Khartoum, Soudan (démo)",
                "count": 23,
                "country": "SU",
                "event_type": "protest",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-4.0, 17.6]},
            "properties": {
                "name": "Mali (démo)",
                "count": 12,
                "country": "ML",
                "event_type": "offensive",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [30.5, 50.4]},
            "properties": {
                "name": "Kyiv, Ukraine (démo)",
                "count": 9,
                "country": "UP",
                "event_type": "ceasefire",
            },
        },
    ],
}


def filter_demo_events(event_type: str = "all", country: Optional[str] = None) -> dict:
    features = DEMO_EVENTS["features"]
    if event_type and event_type != "all":
        features = [f for f in features if f["properties"]["event_type"] == event_type]
    if country:
        features = [f for f in features if f["properties"]["country"] == country]
    return {"type": "FeatureCollection", "features": features}
