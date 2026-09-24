"""Jeu de données factice pour la couche nucléaire, utilisé si Wikidata
est inaccessible. Sites civils réels, publics et largement documentés
(presse, Wikipedia, AIEA) - choisis pour leur pertinence géopolitique
actuelle."""

NUCLEAR_DEMO_SITES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [34.585, 47.512]},
            "properties": {
                "name": "Centrale de Zaporijjia (démo)",
                "country": "Ukraine",
                "status": "Sous contrôle militaire, à l'arrêt",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [30.099, 51.389]},
            "properties": {
                "name": "Centrale de Tchernobyl (démo)",
                "country": "Ukraine",
                "status": "Arrêtée",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [141.033, 37.421]},
            "properties": {
                "name": "Centrale de Fukushima Daiichi (démo)",
                "country": "Japon",
                "status": "Arrêtée",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [51.883, 28.977]},
            "properties": {
                "name": "Centrale de Bouchehr (démo)",
                "country": "Iran",
                "status": "En service",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [51.727, 33.722]},
            "properties": {
                "name": "Site d'enrichissement de Natanz (démo)",
                "country": "Iran",
                "status": "Sous garanties AIEA",
            },
        },
    ],
}
