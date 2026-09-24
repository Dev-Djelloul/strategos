"""Cache disque avec repli sur la dernière donnée RÉELLE connue.

Principe : une donnée fraîche du cache est servie directement ; sinon on
interroge la source (avec quelques tentatives). Si la source est
injoignable, on sert la dernière donnée réelle en cache, clairement
marquée comme périmée (stale) avec son horodatage - jamais de donnée
fabriquée. Sans cache et sans source : l'erreur remonte.
"""
import asyncio
import datetime
import json
import re
from pathlib import Path
from typing import Awaitable, Callable

CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache" / "layers"
RETRY_DELAYS = (0, 2, 5)  # secondes avant chaque tentative


def _path(key: str) -> Path:
    return CACHE_DIR / f"{re.sub(r'[^a-zA-Z0-9_-]', '_', key)}.json"


def _read(key: str):
    try:
        return json.loads(_path(key).read_text())
    except (OSError, ValueError):
        return None


def _age_seconds(entry: dict) -> float:
    fetched = datetime.datetime.fromisoformat(entry["fetched_at"])
    return (datetime.datetime.now(datetime.timezone.utc) - fetched).total_seconds()


class WarmingUp(RuntimeError):
    """Premier chargement d'une source lente encore en cours (pas de cache)."""


_inflight: dict = {}
_last_error: dict = {}


async def _refresh(key: str, fetch_fn: Callable[[], Awaitable[dict]]) -> dict:
    last_exc: Exception = RuntimeError("source indisponible")
    try:
        for delay in RETRY_DELAYS:
            if delay:
                await asyncio.sleep(delay)
            try:
                data = await fetch_fn()
            except Exception as exc:  # noqa: BLE001 - toute panne source -> repli cache
                last_exc = exc
                continue
            fetched_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            _path(key).write_text(json.dumps({"fetched_at": fetched_at, "data": data}))
            _last_error.pop(key, None)
            return {"fetched_at": fetched_at, "data": data}
        _last_error[key] = str(last_exc) or type(last_exc).__name__
        raise last_exc
    finally:
        _inflight.pop(key, None)


async def cached_fetch(key: str, ttl_seconds: int, fetch_fn: Callable[[], Awaitable[dict]], wait_seconds: float = 8) -> dict:
    """Sert le cache s'il est frais. Sinon lance (une seule fois) une
    actualisation en arrière-plan : avec un ancien cache on le sert tout de
    suite (marqué périmé), sans cache on attend wait_seconds au plus."""
    entry = _read(key)
    if entry and _age_seconds(entry) < ttl_seconds:
        return {**entry["data"], "fetched_at": entry["fetched_at"], "stale": False}

    task = _inflight.get(key)
    if task is None:
        task = _inflight[key] = asyncio.create_task(_refresh(key, fetch_fn))

    if entry:
        reason = _last_error.get(key) or "actualisation en cours"
        return {**entry["data"], "fetched_at": entry["fetched_at"], "stale": True, "stale_reason": reason}

    try:
        fresh = await asyncio.wait_for(asyncio.shield(task), wait_seconds)
    except asyncio.TimeoutError:
        raise WarmingUp("premier chargement en cours (source lente), réessaie dans quelques instants")
    return {**fresh["data"], "fetched_at": fresh["fetched_at"], "stale": False}
