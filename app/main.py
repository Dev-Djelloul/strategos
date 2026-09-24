import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.services.acled import COUNTRIES, EVENT_TYPE_MAP, fetch_conflict_events
from app.services.conflicts import PRIORITY, fetch_conflicts
from app.services.gdelt import fetch_gdelt_events
from app.services.infrastructure import fetch_infrastructure_sites
from app.services.military import fetch_military_sites
from app.services.nuclear import fetch_nuclear_sites
from app.services.sources_info import BASEMAP_CREDITS, CONFLICT_SOURCES, LAYER_SOURCES, configured
from app.services.ucdp import fetch_ucdp_events

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Préchauffe les couches lentes (Overpass, Wikidata) en arrière-plan :
    # à la première ouverture de la page, le cache est déjà prêt.
    async def warm(fn):
        try:
            await fn()
        except Exception:  # noqa: BLE001 - simple préchauffage, l'erreur sera rejouée à la demande
            pass

    tasks = [asyncio.create_task(warm(fn)) for fn in (fetch_nuclear_sites, fetch_military_sites, fetch_infrastructure_sites)]
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(title="Strategos", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


async def _layer_response(source_name: str, fetch_fn):
    """Sert une couche avec des données réelles uniquement : en cas
    d'échec de la source on renvoie une erreur 503 explicite plutôt que
    de fabriquer des données."""
    try:
        result = await fetch_fn()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"{source_name} : {str(exc) or type(exc).__name__}")
    result["source"] = source_name
    return result


def _asset_version() -> int:
    # Cache-busting : le navigateur recharge les fichiers modifiés au lieu
    # de servir une ancienne version en cache.
    return int(max((BASE_DIR / "static" / f).stat().st_mtime for f in ("app.js", "style.css")))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            # Optionnel : sans token, le globe reste plat (ellipsoïde) au
            # lieu d'afficher le relief. Compte gratuit sur ion.cesium.com.
            "asset_version": _asset_version(),
            "cesium_ion_token": os.environ.get("CESIUM_ION_TOKEN", ""),
        },
    )


@app.get("/methodologie", response_class=HTMLResponse)
async def methodology(request: Request):
    sources = [{**src, "configured": configured(src)} for src in CONFLICT_SOURCES]
    return templates.TemplateResponse(
        "methodology.html",
        {
            "request": request,
            "asset_version": _asset_version(),
            "sources": sources,
            "layers": LAYER_SOURCES,
            "credits": BASEMAP_CREDITS,
        },
    )


@app.get("/api/filters")
async def get_filters():
    """Options disponibles pour les filtres pays / type d'événement."""
    return {
        "event_types": list(EVENT_TYPE_MAP.keys()),
        "countries": [{"code": code, "name": name} for code, name in COUNTRIES.items()],
    }


@app.get("/api/events")
async def get_events(
    days: int = Query(default=1, ge=1, le=90, description="Fenêtre en jours (données ACLED, mises à jour quotidiennement)"),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
):
    return await _layer_response("acled", lambda: fetch_conflict_events(event_type=event_type, country=country, days=days))


@app.get("/api/conflicts")
async def get_conflicts(
    days: int = Query(default=1, ge=1, le=90),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
    sources: str = Query(default=",".join(PRIORITY), description="Sources à fusionner, séparées par des virgules"),
):
    """Événements de conflit fusionnés (ACLED + UCDP + GDELT) avec niveau de
    fiabilité ; l'état de chaque source est renvoyé dans `sources`."""
    wanted = [s for s in sources.split(",") if s in PRIORITY]
    return await fetch_conflicts(wanted, event_type, country, days)


@app.get("/api/ucdp-events")
async def get_ucdp_events(
    days: int = Query(default=30, ge=1, le=90),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
):
    """Événements géoréférencés UCDP GED (Uppsala), jeton requis."""
    return await _layer_response("ucdp", lambda: fetch_ucdp_events(event_type=event_type, country=country, days=days))


@app.get("/api/gdelt-events")
async def get_gdelt_events(
    days: int = Query(default=1, ge=1, le=90),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
):
    """Événements de violence détectés dans la presse mondiale (GDELT, non vérifiés)."""
    return await _layer_response("gdelt", lambda: fetch_gdelt_events(event_type=event_type, country=country, days=days))


@app.get("/api/nuclear-sites")
async def get_nuclear_sites():
    """Installations nucléaires civiles déclarées (source: Wikidata)."""
    return await _layer_response("wikidata", fetch_nuclear_sites)


@app.get("/api/military-sites")
async def get_military_sites():
    """Bases militaires nommées et publiques (source: OpenStreetMap/Overpass)."""
    return await _layer_response("overpass", fetch_military_sites)


@app.get("/api/infrastructure-sites")
async def get_infrastructure_sites():
    """Aéroports, ports, énergie (source: OpenStreetMap/Overpass)."""
    return await _layer_response("overpass", fetch_infrastructure_sites)
