#!/usr/bin/env python3
"""Construit worker/public/data/ukraine-control.json à partir de VIINA 2.0
(Université Notre-Dame, licence ODbL : https://github.com/zhukovyuri/VIINA).

Le fichier de contrôle territorial de l'année pèse ~25 Mo compressé (~450 Mo
en CSV, Git LFS) : trop lourd pour un Worker, d'où ce traitement séparé
(exécutable à la main, ou automatiquement via .github/workflows/update-control.yml).
Le résultat est un petit fichier statique : les localités actuellement sous
contrôle russe ou contesté, plus celles qui ont changé de main dans la
fenêtre récente, avec la date du changement et le statut précédent (pour
que le globe puisse rejouer l'évolution avec la timeline).

Limite : seul le DERNIER changement de chaque localité est gardé. Une
localité qui a changé de main plusieurs fois dans la fenêtre affichera donc
un statut approximatif pour les dates antérieures à cet ultime changement.

Usage : python3 scripts/build_control.py [--year 2026] [--window 90]
Sans dépendance externe (bibliothèque standard uniquement).
"""
import argparse
import csv
import datetime
import io
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path

RAW = "https://raw.githubusercontent.com/zhukovyuri/VIINA/main/Data"
MEDIA = "https://media.githubusercontent.com/media/zhukovyuri/VIINA/main/Data"  # Git LFS
OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "ukraine-control.json"
CODE = {"UA": "U", "RU": "R", "CONTESTED": "C"}


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Strategos/0.2 (projet pedagogique)"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=datetime.date.today().year)
    ap.add_argument("--window", type=int, default=90, help="jours pendant lesquels un changement de main est conservé")
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="viina_"))
    zpath, gpath = tmp / "control.zip", tmp / "tess.geojson"
    print("Téléchargement du contrôle territorial…")
    download(f"{MEDIA}/control_latest_{args.year}.zip", zpath)
    print("Téléchargement des localités…")
    download(f"{RAW}/gn_UA_tess.geojson", gpath)

    # Passe unique en flux sur ~9 M de lignes (jours dans l'ordre chronologique) :
    # dernier statut connu et date du dernier changement, par localité.
    status: dict = {}
    changed: dict = {}
    latest = ""
    with zipfile.ZipFile(zpath) as z, io.TextIOWrapper(z.open(z.namelist()[0]), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            gid, date, st = row["geonameid"], row["date"], CODE.get(row["status"])
            if st is None:
                continue
            latest = max(latest, date)
            prev = status.get(gid)
            if prev is not None and prev != st:
                changed[gid] = (date, prev)
            status[gid] = st
    as_of = datetime.datetime.strptime(latest, "%Y%m%d").date()
    cutoff = (as_of - datetime.timedelta(days=args.window)).strftime("%Y%m%d")

    places = []
    for feat in json.load(open(gpath, encoding="utf-8"))["features"]:
        p = feat["properties"]
        gid = str(int(p["geonameid"]))
        st = status.get(gid)
        ch, prev_st = changed.get(gid, ("", None))
        recent = ch >= cutoff if ch else False
        # On garde ce qui n'est pas déjà "évident" : zones russes/contestées
        # et changements récents (même si la localité est redevenue ukrainienne).
        if st in ("R", "C") or recent:
            places.append([
                round(p["longitude"], 4), round(p["latitude"], 4), st,
                int(ch) if recent else 0, p.get("asciiname") or p.get("name"), p.get("ADM1_NAME"),
                prev_st if recent else None,
            ])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "VIINA 2.0 (Université Notre-Dame)",
        "license": "ODbL 1.0",
        "url": "https://github.com/zhukovyuri/VIINA",
        "as_of": as_of.isoformat(),
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "window_days": args.window,
        "fields": ["lon", "lat", "status(R|C|U)", "changed(YYYYMMDD|0)", "name", "admin1", "prevStatus(R|C|U|null)"],
        "places": places,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n = {k: sum(1 for p in places if p[2] == k) for k in "RCU"}
    print(f"{len(places)} localités écrites ({n}) — données au {as_of} — {OUT.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
