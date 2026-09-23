from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
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
    timespan: str = Query(default="24h"),
    event_type: str = Query(default="all"),
    country: Optional[str] = Query(default=None),
    demo: bool = Query(default=False, description="Retourne des données factices sans appel réseau"),
):
    if demo:
        return filter_demo_events(event_type=event_type, country=country)
    query = build_query(event_type=event_type, country=country)
    try:
        return await fetch_conflict_events(query=query, timespan=timespan)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur GDELT: {exc}") from exc
