#!/usr/bin/env python3
"""Construit worker/public/data/yemen-control.json à partir du dataset
ACAPS « Yemen: Areas of control » (licence CC BY, hébergé sur HDX/OCHA :
https://data.humdata.org/dataset/yemen-areas-of-control).

Contrairement à VIINA (Ukraine), il n'y a pas de front quotidien : ACAPS
publie un polygone par district (admin2) toutes les ~12 semaines. Le fichier
n'est distribué qu'au format Shapefile — d'où le mini lecteur SHP/DBF ci-
dessous (bibliothèque standard uniquement, même choix que build_control.py).

Limite du lecteur SHP : chaque anneau (« part ») d'un polygone est exporté
comme un polygone séparé d'un MultiPolygon, sans distinguer contour externe
et trou. Sans conséquence pour les formes réelles de ce jeu de données
(quasi toutes des polygones simples ou multi-parties sans trou).

Usage : python3 scripts/build_yemen_control.py
Sans dépendance externe (bibliothèque standard uniquement).
"""
import datetime
import json
import struct
import tempfile
import urllib.request
import zipfile
from pathlib import Path

HDX_PACKAGE = "https://data.humdata.org/api/3/action/package_show?id=yemen-areas-of-control"
OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "yemen-control.json"
USER_AGENT = "Strategos/0.2 (projet pedagogique; contact: digitalblueskye@gmail.com)"

# Codes observés dans le champ areas_of_c du dataset ACAPS (voir aussi
# https://www.acaps.org/en/countries/yemen pour le contexte).
CONTROLLER_LABELS = {
    "IRG": "Gouvernement internationalement reconnu (IRG)",
    "DFA": "Autorités de facto — Ansar Allah/Houthis (DFA)",
    "STC": "Conseil de transition du Sud (STC)",
    "AQAP": "Al-Qaïda dans la péninsule Arabique (AQAP)",
}


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def latest_shp_resource() -> dict:
    payload = json.loads(http_get(HDX_PACKAGE))
    resources = [r for r in payload["result"]["resources"] if r["format"] == "SHP"]
    if not resources:
        raise SystemExit("Aucune ressource SHP trouvée dans le dataset ACAPS.")
    return max(resources, key=lambda r: r["created"])


def read_dbf(data: bytes) -> list[dict]:
    """Lecteur DBF minimal (champs texte/numériques usuels des shapefiles HDX)."""
    n_records, header_len, record_len = struct.unpack_from("<I H H", data, 4)
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos : pos + 11].split(b"\x00")[0].decode("ascii")
        length = data[pos + 16]
        fields.append((name, length))
        pos += 32
    records = []
    pos = header_len
    for _ in range(n_records):
        row = data[pos : pos + record_len]
        pos += record_len
        if row[0:1] == b"*":  # enregistrement supprimé
            continue
        rec, off = {}, 1
        for name, length in fields:
            rec[name] = row[off : off + length].decode("latin-1").strip()
            off += length
        records.append(rec)
    return records


def read_shp(data: bytes) -> list[list[list[list[float]]]]:
    """Lecteur SHP minimal : ne gère que le type 5 (Polygon), seul type
    utilisé par ce dataset. Renvoie, par enregistrement, une liste d'anneaux
    (chacun une liste de points [lon, lat])."""
    shapes = []
    pos = 100  # en-tête fichier fixe
    while pos < len(data):
        _rec_num, content_len = struct.unpack_from(">II", data, pos)
        content_start = pos + 8
        shape_type = struct.unpack_from("<I", data, content_start)[0]
        rings: list[list[list[float]]] = []
        if shape_type == 5:
            num_parts, num_points = struct.unpack_from("<ii", data, content_start + 36)
            parts_off = content_start + 44
            points_off = parts_off + 4 * num_parts
            parts = list(struct.unpack_from(f"<{num_parts}i", data, parts_off)) + [num_points]
            points = struct.unpack_from(f"<{2 * num_points}d", data, points_off)
            for i in range(num_parts):
                start, end = parts[i], parts[i + 1]
                ring = [[points[2 * j], points[2 * j + 1]] for j in range(start, end)]
                rings.append(ring)
        shapes.append(rings)
        pos = content_start + content_len * 2  # content_len en mots de 16 bits
    return shapes


def main() -> None:
    resource = latest_shp_resource()
    print(f"Ressource ACAPS : {resource['name']} ({resource['created'][:10]})")
    tmp = Path(tempfile.mkdtemp(prefix="yemen_control_"))
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

    features = []
    for rings, rec in zip(shapes, records):
        if not rings:
            continue
        controller = (rec.get("areas_of_c") or rec.get("areas_of_") or "").strip() or "UNKNOWN"
        rounded = [[[round(lon, 4), round(lat, 4)] for lon, lat in ring] for ring in rings]
        features.append({
            "type": "Feature",
            "geometry": {"type": "MultiPolygon", "coordinates": [[ring] for ring in rounded]},
            "properties": {
                "admin1": rec.get("ADM1_EN"),
                "admin2": rec.get("ADM2_EN"),
                "controller": controller,
                "controller_label": CONTROLLER_LABELS.get(controller, controller),
            },
        })

    # Le champ "date_" du DBF ACAPS n'est pas fiable (valeurs historiques
    # incohérentes) : on utilise la date de publication de la ressource HDX.
    as_of = resource["created"][:10]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "ACAPS — Yemen Analysis Hub",
        "license": "CC BY 4.0",
        "url": "https://data.humdata.org/dataset/yemen-areas-of-control",
        "as_of": as_of,
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "features": features,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    controllers = sorted({f["properties"]["controller"] for f in features})
    print(f"{len(features)} districts écrits — données au {as_of} — {OUT.stat().st_size // 1024} Ko")
    print("Contrôleurs distincts :", controllers)


if __name__ == "__main__":
    main()
