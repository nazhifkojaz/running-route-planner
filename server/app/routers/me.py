import httpx
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request

from ..core.config import PROFILE_TTL, STATS_TTL, RUNS_TTL
from ..core.security import resolve_user
from ..crud import (
    get_user_by_athlete_id,
    update_user_fields,
)
from ..services.strava import (
    refresh_if_needed,
    fetch_athlete_profile,
    fetch_athlete_stats,
    fetch_last_runs_averages,
    now_utc,
)
from ..schemas import MeOut, SyncOut

router = APIRouter()

def is_stale(ts: datetime | None, ttl) -> bool:
    if not ts: return True
    return (now_utc() - ts) > ttl

@router.get("/", response_model=dict)
def root():
    return {"msg": "API ready. See /healthz, /docs, /auth/strava/start, /me, /me/sync"}

@router.get("/healthz", response_model=dict)
def healthz():
    return {"ok": True}

@router.get("/me", response_model=MeOut)
async def me(request: Request):
    u = resolve_user(request)
    if not u:
        return MeOut(connected=False)
    return MeOut(
        connected=True,
        strava_athlete_id=u["strava_athlete_id"],
        username=u.get("username"),
        weight_kg=u.get("weight_kg"),
        run_count_all=u.get("run_count_all"),
        run_distance_all_m=u.get("run_distance_all_m"),
        avg_pace_5_sec_per_km=u.get("avg_pace_5_sec_per_km"),
        avg_hr_5=u.get("avg_hr_5"),
        avg_pace_sec_per_km=u.get("avg_pace_sec_per_km"),
        avg_heart_rate=u.get("avg_heart_rate"),
        cached_profile_at=u.get("cached_profile_at"),
        cached_stats_at=u.get("cached_stats_at"),
        cached_runs_at=u.get("cached_runs_at"),
    )

@router.post("/me/sync", response_model=SyncOut)
async def sync_me(request: Request):
    u = resolve_user(request)
    if not u:
        raise HTTPException(401, "Not signed in")

    try:
        refreshed = await refresh_if_needed(u)
    except httpx.HTTPStatusError:
        raise HTTPException(502, "Failed to refresh Strava token")

    if isinstance(refreshed, tuple):
        at, rt, exp = refreshed
        update_user_fields(u["strava_athlete_id"], {
            "access_token": at, "refresh_token": rt, "expires_at": exp
        })
        u = get_user_by_athlete_id(u["strava_athlete_id"])

    token = u["access_token"]
    athlete_id = int(u["strava_athlete_id"])

    updates = {}

    try:
        if is_stale(u.get("cached_profile_at"), PROFILE_TTL):
            prof = await fetch_athlete_profile(token)
            updates |= {"username": prof["username"], "weight_kg": prof["weight_kg"], "cached_profile_at": now_utc()}
            athlete_id = int(prof["athlete_id"] or athlete_id)

        if is_stale(u.get("cached_stats_at"), STATS_TTL):
            st = await fetch_athlete_stats(token, athlete_id)
            updates |= {"run_count_all": st["run_count_all"], "run_distance_all_m": st["run_distance_all_m"], "cached_stats_at": now_utc()}

        if is_stale(u.get("cached_runs_at"), RUNS_TTL):
            last5 = await fetch_last_runs_averages(token, n=5)
            updates |= {
                "avg_pace_5_sec_per_km": last5["avg_pace_5_sec_per_km"],
                "avg_hr_5": last5["avg_hr_5"],
                "last_run_id": last5["last_run_id"],
                "cached_runs_at": now_utc()
            }
    except httpx.HTTPStatusError:
        raise HTTPException(502, "Failed to fetch data from Strava")

    if updates:
        update_user_fields(athlete_id, updates)
        u = get_user_by_athlete_id(athlete_id)

    return SyncOut(
        ok=True,
        strava_athlete_id=athlete_id,
        username=u.get("username"),
        weight_kg=u.get("weight_kg"),
        run_count_all=u.get("run_count_all"),
        run_distance_all_m=u.get("run_distance_all_m"),
        avg_pace_5_sec_per_km=u.get("avg_pace_5_sec_per_km"),
        avg_hr_5=u.get("avg_hr_5"),
        cached_profile_at=u.get("cached_profile_at"),
        cached_stats_at=u.get("cached_stats_at"),
        cached_runs_at=u.get("cached_runs_at"),
    )
