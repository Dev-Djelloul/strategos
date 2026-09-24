"""Données factices pour la couche infrastructures, utilisées si
Overpass est inaccessible."""

INFRASTRUCTURE_DEMO_SITES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-77.037, 38.852]},
            "properties": {"name": "Aéroport Reagan (démo)", "type": "aerodrome", "operator": None},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [30.523, 46.483]},
            "properties": {"name": "Port d'Odessa (démo)", "type": "port", "operator": None},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [56.235, 27.144]},
            "properties": {"name": "Centrale électrique de Hormuz (démo)", "type": "plant", "operator": None},
        },
    ],
}
