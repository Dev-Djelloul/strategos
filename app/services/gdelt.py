"""Client GDELT 2.0 (Global Database of Events, Language, and Tone).

GDELT publie toutes les 15 minutes un fichier d'événements extraits de la
presse mondiale, sans clé ni inscription. Ce ne sont PAS des données
vérifiées (codage automatique d'articles, bruit possible) : on ne garde
donc que les événements de violence matérielle (racines CAMEO 18-20)
localisés à l'échelle d'une ville/région et rapportés par au moins deux
sources distinctes, puis on agrège par lieu et type.

Les fichiers de 15 minutes sont immuables : chaque fichier filtré est mis
en cache sur disque, seuls les nouveaux sont téléchargés.
"""
import asyncio
import csv
import datetime
import io
import json
import math
import zipfile
from pathlib import Path
from typing import Optional

import httpx

BASE_URL = "https://data.gdeltproject.org/gdeltv2"
CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache" / "gdelt"
MAX_FILES = 200
MAX_FEATURES = 800
MIN_SOURCES = 2

# Colonnes du fichier export GDELT 2.0 (index 0-based).
C_DATE, C_CODE, C_ROOT, C_MENTIONS, C_SOURCES = 1, 26, 28, 31, 32
C_GEO_TYPE, C_GEO_NAME, C_COUNTRY, C_LAT, C_LON, C_URL = 51, 52, 53, 56, 57, 60
N_COLUMNS = 61

ROOT_TO_TYPE = {"18": "casualties", "19": "offensive", "20": "casualties"}
AERIAL_CODE = "195"  # "employ aerial weapons"

# Pays suivis (code FIPS utilisé par GDELT -> code de l'app, cf. acled.COUNTRIES).
FIPS_TO_APP = {
    "UP": "UA", "RS": "RU", "IS": "IL", "SY": "SY", "SU": "SD", "ML": "ML",
    "AF": "AF", "IR": "IR", "IZ": "IQ", "YM": "YE",
}


def _stamps(days: int) -> list:
    """Horodatages des fichiers 15 min couvrant la fenêtre, échantillonnés
    régulièrement si elle dépasse MAX_FILES fichiers."""
    now = datetime.datetime.utcnow().replace(second=0, microsecond=0)
    now -= datetime.timedelta(minutes=now.minute % 15 + 15)  # dernier fichier sûrement publié
    total = days * 96
    step = max(1, math.ceil(total / MAX_FILES))
    return [(now - datetime.timedelta(minutes=15 * i)).strftime("%Y%m%d%H%M00") for i in range(0, total, step)], step


def _parse(raw: bytes) -> list:
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        text = zf.read(zf.namelist()[0]).decode("utf-8", errors="replace")
    rows = []
    for r in csv.reader(io.StringIO(text), delimiter="\t"):
        if len(r) < N_COLUMNS or r[C_ROOT] not in ROOT_TO_TYPE:
            continue
        try:
            lat, lon = float(r[C_LAT]), float(r[C_LON])
            sources, mentions = int(r[C_SOURCES]), int(r[C_MENTIONS])
        except ValueError:
            continue
        # 1 = pays entier (centroïde), trop imprécis pour un point sur le globe.
        if r[C_GEO_TYPE] in ("", "1") or sources < MIN_SOURCES:
            continue
        rows.append([r[C_DATE], r[C_CODE], r[C_ROOT], mentions, r[C_GEO_NAME], r[C_COUNTRY], lat, lon, r[C_URL]])
    return rows


async def _load_file(client: httpx.AsyncClient, stamp: str, sem: asyncio.Semaphore) -> Optional[list]:
    cache = CACHE_DIR / f"{stamp}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    async with sem:
        resp = await client.get(f"{BASE_URL}/{stamp}.export.CSV.zip")
    if resp.status_code == 404:
        return None  # fichier absent chez GDELT (ça arrive), on l'ignore
    resp.raise_for_status()
    rows = _parse(resp.content)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(rows))
    return rows


async def fetch_gdelt_events(event_type: str = "all", country: Optional[str] = None, days: int = 1) -> dict:
    stamps, step = _stamps(days)
    sem = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        results = await asyncio.gather(*(_load_file(client, s, sem) for s in stamps), return_exceptions=True)

    files = [r for r in results if isinstance(r, list)]
    if not files:
        errors = [r for r in results if isinstance(r, Exception)]
        raise RuntimeError(f"aucun fichier GDELT récupéré ({errors[0] if errors else 'indisponible'})")

    # Agrégation par lieu (~1 km) et type d'événement.
    groups: dict = {}
    for rows in files:
        for date, code, root, mentions, name, fips, lat, lon, url in rows:
            etype = "airstrike" if code.startswith(AERIAL_CODE) else ROOT_TO_TYPE[root]
            app_country = FIPS_TO_APP.get(fips)
            if event_type != "all" and etype != event_type:
                continue
            if country and app_country != country:
                continue
            key = (round(lat, 2), round(lon, 2), etype)
            g = groups.setdefault(key, {"name": name, "count": 0, "date": date, "url": url, "country": app_country, "lat": lat, "lon": lon})
            g["count"] += mentions
            if date > g["date"]:
                g["date"], g["url"] = date, url

    top = sorted(groups.items(), key=lambda kv: kv[1]["count"], reverse=True)[:MAX_FEATURES]
    features = []
    for (_, _, etype), g in top:
        d = g["date"]
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [g["lon"], g["lat"]]},
            "properties": {
                "name": g["name"],
                "event_type": etype,
                "event_date": f"{d[0:4]}-{d[4:6]}-{d[6:8]}",
                "count": g["count"],
                "country": g["country"],
                "source_url": g["url"],
                "notes": "Événement détecté automatiquement dans la presse (GDELT), non vérifié.",
            },
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"files": len(files), "sampled": step > 1},
    }
