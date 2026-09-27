#!/usr/bin/env python3
"""Construit worker/public/data/westbank-control.json à partir du dataset
OCHA-oPt « Oslo Agreement in the West Bank » (zones A/B/C, Jérusalem-Est,
« no man's land »), hébergé sur HDX : https://data.humdata.org/dataset/
state-of-palestine-other-0-0-0-0-0.

Contrairement à VIINA (Ukraine) ou même ACAPS (Yémen), ce n'est PAS un
front ni un contrôle qui évolue : c'est la classification LÉGALE issue des
accords d'Oslo (1995), inchangée depuis — le fichier source lui-même date
de 2015 et n'a plus été mis à jour depuis (rien à mettre à jour : la
classification n'a pas changé). À afficher explicitement comme telle, pas
comme une ligne de front actuelle.

Limite volontaire : ne couvre QUE la Cisjordanie. Aucune source fiable et
à jour n'a été trouvée pour Gaza (le seul dataset structuré disponible,
« Gaza Strip Buffer Area », date du 19/10/2023 — la zone tampon d'AVANT
l'expansion du contrôle militaire israélien pendant la guerre en cours ;
l'utiliser comme contrôle « actuel » serait trompeur).

Usage : python3 scripts/build_westbank_control.py
Sans dépendance externe (bibliothèque standard uniquement).
"""
import datetime
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from shp_reader import read_dbf, read_shp

HDX_PACKAGE = "https://data.humdata.org/api/3/action/package_show?id=state-of-palestine-other-0-0-0-0-0"
OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "westbank-control.json"
USER_AGENT = "Strategos/0.2 (projet pedagogique; contact: digitalblueskye@gmail.com)"

# Valeurs observées dans le champ "class" du shapefile OCHA-oPt (2015).
ZONE_LABELS = {
    "A": "Zone A — contrôle civil et sécuritaire palestinien",
    "B": "Zone B — contrôle civil palestinien, sécuritaire israélien",
    "C": "Zone C — contrôle civil et sécuritaire israélien",
    "H1": "Hébron H1 — contrôle palestinien",
    "H2": "Hébron H2 — contrôle israélien (dont enclaves de colons)",
    "NO MAN'S LAND": "Zone tampon (« no man's land »)",
    "ISRAELI DECLARED EAST JERUSALEM": "Jérusalem-Est (annexée par Israël, non reconnue internationalement)",
    "NATURE RESERVE": "Réserve naturelle (statut de contrôle variable)",
}


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def find_shp_resource() -> dict:
    payload = json.loads(http_get(HDX_PACKAGE))
    resources = [r for r in payload["result"]["resources"] if r["format"] == "SHP"]
    if not resources:
        raise SystemExit("Aucune ressource SHP trouvée dans le dataset OCHA-oPt.")
    return resources[0]


def main() -> None:
    resource = find_shp_resource()
    print(f"Ressource OCHA-oPt : {resource['name']} ({resource['created'][:10]})")
    tmp = Path(tempfile.mkdtemp(prefix="westbank_control_"))
    zpath = tmp / "control.zip"
    zpath.write_bytes(http_get(resource["url"]))

    with zipfile.ZipFile(zpath) as z:
        names = {n.lower(): n for n in z.namelist()}
        shp_name = next(n for n in names if n.endswith(".shp"))
        dbf_name = next(n for n in names if n.endswith(".dbf"))
        shp_data = z.read(names[shp_name])
        dbf_data = z.read(names[dbf_name])

    shapes = read_shp(shp_data)
    records = read_dbf(dbf_data)
    if len(shapes) != len(records):
        raise SystemExit(f"Désaccord SHP/DBF : {len(shapes)} formes, {len(records)} enregistrements.")

    # Le nom du champ de classification varie selon les exports OCHA
    # ("Type_Ass", "NAME", "Area", ...) : on prend le premier champ texte
    # dont les valeurs correspondent à des zones A/B/C connues.
    zone_field = None
    for name in records[0]:
        values = {r[name].strip().upper() for r in records[:50] if r.get(name)}
        if values & {"A", "B", "C"}:
            zone_field = name
            break
    if zone_field is None:
        raise SystemExit(f"Champ de zone introuvable. Champs disponibles : {list(records[0])}")

    features = []
    for rings, rec in zip(shapes, records):
        if not rings:
            continue
        zone = rec.get(zone_field, "").strip().upper()
        rounded = [[[round(lon, 4), round(lat, 4)] for lon, lat in ring] for ring in rings]
        features.append({
            "type": "Feature",
            "geometry": {"type": "MultiPolygon", "coordinates": [[ring] for ring in rounded]},
            "properties": {
                "zone": zone or "UNKNOWN",
                "zone_label": ZONE_LABELS.get(zone, zone or "Non classé"),
            },
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "OCHA — Territoire palestinien occupé (oPt)",
        "license": "Voir la page HDX du dataset (conditions spécifiques, non CC standard)",
        "url": "https://data.humdata.org/dataset/state-of-palestine-other-0-0-0-0-0",
        "as_of": resource["created"][:10],
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "note": "Classification légale des accords d'Oslo (1995), pas une ligne de front actuelle. Cisjordanie uniquement : aucune source fiable et à jour trouvée pour Gaza.",
        "features": features,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    zones = sorted({f["properties"]["zone"] for f in features})
    print(f"{len(features)} polygones écrits — {OUT.stat().st_size // 1024} Ko")
    print("Zones distinctes :", zones)


if __name__ == "__main__":
    main()
