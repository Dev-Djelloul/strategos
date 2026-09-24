"""Métadonnées descriptives des sources de données (affichées sur la page
Méthodologie). Une seule source de vérité : le contenu de la page est
généré depuis ces listes, et l'état de configuration est lu à l'exécution
(jamais supposé)."""
import os
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache"

CONFLICT_SOURCES = [
    {
        "key": "acled",
        "name": "ACLED",
        "full": "Armed Conflict Location & Event Data",
        "url": "https://acleddata.com/",
        "reliability": "verified",
        "kind": "Événements codés à la main par des analystes, à partir de sources multiples",
        "freshness": "Hebdomadaire (niveau Research : événements décalés d'environ une semaine)",
        "coverage": "Mondiale",
        "license": "Conditions d'utilisation ACLED — attribution obligatoire, pas de redistribution",
        "access": "Compte myACLED ; l'API d'événements exige le niveau Research ou supérieur",
        "env": ("ACLED_EMAIL", "ACLED_PASSWORD"),
    },
    {
        "key": "ucdp",
        "name": "UCDP GED",
        "full": "Uppsala Conflict Data Program — Georeferenced Event Dataset",
        "url": "https://ucdp.uu.se/",
        "reliability": "verified",
        "kind": "Jeu de données académique évalué par des pairs, événements de violence organisée",
        "freshness": "Publication annuelle (la fenêtre récente est souvent vide)",
        "coverage": "Mondiale",
        "license": "CC BY 4.0 — citer Sundberg & Melander (2013), Journal of Peace Research 50(4)",
        "access": "Jeton d'accès gratuit, sur demande auprès de l'équipe UCDP",
        "env": ("UCDP_ACCESS_TOKEN",),
    },
    {
        "key": "gdelt",
        "name": "GDELT",
        "full": "Global Database of Events, Language, and Tone",
        "url": "https://www.gdeltproject.org/",
        "reliability": "press",
        "kind": "Extraction automatique d'événements dans la presse mondiale — non vérifiée",
        "freshness": "Toutes les 15 minutes",
        "coverage": "Mondiale, très inégale selon la couverture médiatique",
        "license": "Libre d'usage, citation du projet GDELT demandée",
        "access": "Aucun compte requis",
        "env": (),
    },
]

LAYER_SOURCES = [
    {
        "name": "Sites nucléaires civils",
        "provider": "Wikidata",
        "url": "https://www.wikidata.org/",
        "freshness": "Cache 24 h",
        "license": "CC0",
        "note": "Centrales et sites civils déclarés uniquement. Base collaborative, non exhaustive.",
    },
    {
        "name": "Bases militaires",
        "provider": "OpenStreetMap (Overpass)",
        "url": "https://www.openstreetmap.org/",
        "freshness": "Cache 6 h",
        "license": "ODbL — © contributeurs OpenStreetMap",
        "note": "Sites nommés et publics uniquement. Base collaborative, non exhaustive.",
    },
    {
        "name": "Infrastructures",
        "provider": "OpenStreetMap (Overpass)",
        "url": "https://www.openstreetmap.org/",
        "freshness": "Cache 6 h",
        "license": "ODbL — © contributeurs OpenStreetMap",
        "note": "Aéroports internationaux, ports, centrales électriques non nucléaires.",
    },
]

BASEMAP_CREDITS = [
    ("Imagerie satellite et calques de référence", "Esri, Maxar, Earthstar Geographics"),
    ("Relief mondial", "Cesium World Terrain (Cesium ion)"),
    ("Villes 3D photoréalistes", "Google Photorealistic 3D Tiles, via Cesium ion — soumis aux conditions de Google"),
    ("Moteur 3D", "CesiumJS"),
]


def configured(source: dict) -> bool:
    """Vrai si les identifiants requis sont présents dans l'environnement."""
    return all(os.environ.get(name) for name in source["env"])
