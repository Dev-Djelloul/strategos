from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.services.demo_data import filter_demo_events
from app.services.gdelt import COUNTRY_CODES, EVENT_TYPE_KEYWORDS, build_query, fetch_conflict_events

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Strategos")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/filters")
async def get_filters():
    """Options disponibles pour les filtres pays / type d'événement."""
    return {
        "event_types": list(EVENT_TYPE_KEYWORDS.keys()),
        "countries": [{"code": code, "name": name} for code, name in COUNTRY_CODES.items()],
    }


@app.get("/api/events")
async def get_events(
    timespan_minutes: int = Query(default=1440, ge=15, le=1440, description="Fenêtre temporelle en minutes (15 à 1440, soit 24h max)"),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
    demo: bool = Query(default=False, description="Retourne des données factices sans appel réseau"),
):
    if demo:
        result = filter_demo_events(event_type=event_type, country=country)
        result["source"] = "demo"
        return result

    query = build_query(event_type=event_type, country=country)
    try:
        result = await fetch_conflict_events(query=query, timespan_minutes=timespan_minutes)
        result["source"] = "gdelt"
        return result
    except Exception:
        # L'endpoint GEO de GDELT est un service gratuit sans garantie de
        # disponibilité (404 intermittents documentés côté GDELT, hors de
        # notre contrôle). On dégrade proprement vers les données démo
        # plutôt que de casser l'app.
        result = filter_demo_events(event_type=event_type, country=country)
        result["source"] = "demo_fallback"
        return result
