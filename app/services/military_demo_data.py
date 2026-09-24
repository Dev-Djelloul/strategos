"""Données factices pour la couche bases militaires, utilisées si
Overpass est inaccessible. Sites réels et publics (déjà largement
documentés)."""

MILITARY_DEMO_SITES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-77.146, 38.871]},
            "properties": {"name": "Le Pentagone (démo)", "type": "base", "operator": "US DoD"},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [37.615, 55.752]},
            "properties": {"name": "Ministère de la Défense (démo)", "type": "base", "operator": "Russie"},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [32.017, 48.379]},
            "properties": {"name": "Base aérienne de Vasylkiv (démo)", "type": "airfield", "operator": "Ukraine"},
        },
    ],
}
