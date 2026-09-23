from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.services.demo_data import DEMO_EVENTS
from app.services.gdelt import fetch_conflict_events

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Strategos")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/events")
async def get_events(
    query: str = Query(default="war OR conflict OR airstrike OR ceasefire"),
    timespan: str = Query(default="24h"),
    demo: bool = Query(default=False, description="Retourne des données factices sans appel réseau"),
):
    if demo:
        return DEMO_EVENTS
    try:
        return await fetch_conflict_events(query=query, timespan=timespan)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur GDELT: {exc}") from exc
