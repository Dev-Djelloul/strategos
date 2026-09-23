from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.services.acled import COUNTRIES, EVENT_TYPE_MAP, fetch_conflict_events
from app.services.demo_data import filter_demo_events

load_dotenv()

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
        "event_types": list(EVENT_TYPE_MAP.keys()),
        "countries": [{"code": code, "name": name} for code, name in COUNTRIES.items()],
    }


@app.get("/api/events")
async def get_events(
    days: int = Query(default=1, ge=1, le=90, description="Fenêtre en jours (données ACLED, mises à jour quotidiennement)"),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
    demo: bool = Query(default=False, description="Retourne des données factices sans appel réseau"),
):
    if demo:
        result = filter_demo_events(event_type=event_type, country=country)
        result["source"] = "demo"
        return result

    try:
        result = await fetch_conflict_events(event_type=event_type, country=country, days=days)
        result["source"] = "acled"
        return result
    except Exception as exc:
        # Pas de compte ACLED configuré, service en panne, ou erreur
        # réseau : on dégrade proprement vers les données démo plutôt que
        # de casser l'app.
        result = filter_demo_events(event_type=event_type, country=country)
        result["source"] = "demo_fallback"
        result["fallback_reason"] = str(exc)
        return result
