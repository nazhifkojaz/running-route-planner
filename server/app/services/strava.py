import time
from datetime import datetime, timezone

import httpx
from typing import Any, Dict

from ..core.config import STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET

_strava_client = httpx.AsyncClient(base_url="https://www.strava.com", timeout=10.0)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def refresh_if_needed(user) -> str | tuple[str, str, int]:
    now = int(time.time())
    if user["expires_at"] - 60 > now:
        return user["access_token"]
    r = await _strava_client.post("/oauth/token", data={
        "client_id": STRAVA_CLIENT_ID,
        "client_secret": STRAVA_CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": user["refresh_token"],
    })
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["refresh_token"], j["expires_at"]


async def fetch_athlete_profile(token: str) -> Dict[str, Any]:
    r = await _strava_client.get(
        "/api/v3/athlete",
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    a = r.json()
    username = a.get("username") or ((a.get("firstname") or "") + " " + (a.get("lastname") or "")).strip() or None
    return {"username": username, "weight_kg": a.get("weight"), "athlete_id": a.get("id")}


async def fetch_athlete_stats(token: str, athlete_id: int) -> Dict[str, Any]:
    r = await _strava_client.get(
        f"/api/v3/athletes/{athlete_id}/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    j = r.json()
    runs = j.get("all_run_totals") or {}
    return {
        "run_count_all": int(runs.get("count") or 0),
        "run_distance_all_m": float(runs.get("distance") or 0),
    }


async def fetch_last_runs_averages(token: str, n: int = 5) -> Dict[str, Any]:
    r = await _strava_client.get(
        "/api/v3/athlete/activities",
        params={"per_page": 50},
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    items = r.json()
    runs = [a for a in items if (a.get("sport_type") or a.get("type")) == "Run"][:n]
    last_run_id = runs[0].get("id") if runs else None
    if not runs:
        return {"avg_pace_5_sec_per_km": None, "avg_hr_5": None, "last_run_id": None}
    paces, hrs = [], []
    for a in runs:
        dist_km = (a.get("distance") or 0) / 1000.0
        mt = a.get("moving_time") or 0
        if dist_km > 0 and mt > 0:
            paces.append(mt / dist_km)
        if a.get("has_heartrate") and a.get("average_heartrate"):
            hrs.append(a["average_heartrate"])
    avg_pace_5 = sum(paces) / len(paces) if paces else None
    avg_hr_5 = sum(hrs) / len(hrs) if hrs else None
    return {"avg_pace_5_sec_per_km": avg_pace_5, "avg_hr_5": avg_hr_5, "last_run_id": last_run_id}
