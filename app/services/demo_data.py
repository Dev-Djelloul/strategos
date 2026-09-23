"""Jeu de données factice utilisé quand GDELT est inaccessible (réseau
restreint) ou pour développer/démontrer l'UI sans dépendance externe."""

DEMO_EVENTS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [37.5, 47.1]},
            "properties": {"name": "Zaporijjia, Ukraine (démo)", "count": 42},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [36.3, 33.5]},
            "properties": {"name": "Damas, Syrie (démo)", "count": 18},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [34.3, 31.5]},
            "properties": {"name": "Gaza (démo)", "count": 67},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [45.0, 15.6]},
            "properties": {"name": "Khartoum, Soudan (démo)", "count": 23},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [30.0, 15.0]},
            "properties": {"name": "Sahel (démo)", "count": 12},
        },
    ],
}
