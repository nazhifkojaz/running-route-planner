from typing import Mapping, Any

from sqlalchemy import text

from .core.security import engine
from .repositories.route_repository import route_repository

ALLOWED_USER_FIELDS = {
    "access_token", "refresh_token", "expires_at", "username", "weight_kg",
    "run_count_all", "run_distance_all_m", "avg_pace_5_sec_per_km",
    "avg_hr_5", "avg_pace_sec_per_km", "avg_heart_rate",
    "last_run_id", "cached_profile_at", "cached_stats_at", "cached_runs_at",
}


def get_user_by_athlete_id(aid: int):
    with engine().begin() as con:
        return con.execute(text("SELECT * FROM users WHERE strava_athlete_id=:aid"),
                           {"aid": aid}).mappings().first()


def upsert_user_tokens(aid: int, access_token: str, refresh_token: str, expires_at: int, user_id: str | None):
    with engine().begin() as con:
        row = con.execute(
            text("""
                INSERT INTO users (id, strava_athlete_id, access_token, refresh_token, expires_at)
                VALUES (gen_random_uuid(), :aid, :at, :rt, :exp)
                ON CONFLICT (strava_athlete_id) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at = EXCLUDED.expires_at,
                    updated_at = NOW()
                RETURNING id
            """),
            dict(aid=aid, at=access_token, rt=refresh_token, exp=expires_at),
        ).mappings().first()
        return str(row["id"])


def create_session(user_id: str, secret: str, sid: str):
    with engine().begin() as con:
        con.execute(text("""
            INSERT INTO sessions (id, user_id, secret, expires_at)
            VALUES (:sid, :uid, :sec, NOW() + INTERVAL '30 days')
        """), dict(sid=sid, uid=user_id, sec=secret))


def update_user_fields(aid: int, updates: Mapping[str, Any]):
    if not updates:
        return
    filtered = {k: v for k, v in updates.items() if k in ALLOWED_USER_FIELDS}
    if not filtered:
        return
    sets = ", ".join([f"{k}=:{k}" for k in filtered.keys()])
    params = dict(filtered)
    params["aid"] = aid
    with engine().begin() as con:
        con.execute(text(f"UPDATE users SET {sets}, updated_at=NOW() WHERE strava_athlete_id=:aid"), params)


def create_route(user_id: str, username_snapshot: str | None, name: str,
                 distance_m: float, city: str | None = None, country: str | None = None,
                 elevation_gain_m: float | None = None, elevation_loss_m: float | None = None,
                 description: str | None = None, visibility: str = "private",
                 geometry: dict | None = None) -> dict:
    return route_repository.create(
        user_id=user_id, username_snapshot=username_snapshot, name=name,
        distance_m=distance_m, city=city, country=country,
        elevation_gain_m=elevation_gain_m, elevation_loss_m=elevation_loss_m,
        description=description, visibility=visibility, geometry=geometry,
    )


def get_route_by_id(route_id: str) -> dict | None:
    return route_repository.get(route_id)


def update_route(route_id: str, user_id: str, updates: Mapping[str, Any]) -> dict | None:
    return route_repository.update(route_id, user_id, updates)


def delete_route(route_id: str, user_id: str) -> bool:
    return route_repository.delete(route_id, user_id)


def list_my_routes(user_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    return route_repository.list_for_user(user_id, limit=limit, offset=offset)


def list_public_routes(limit: int = 50, offset: int = 0, city: str | None = None,
                       country: str | None = None, min_distance_m: float | None = None,
                       max_distance_m: float | None = None) -> list[dict]:
    return route_repository.list_public(
        limit=limit, offset=offset, city=city, country=country,
        min_distance_m=min_distance_m, max_distance_m=max_distance_m,
    )


def count_user_routes(user_id: str) -> int:
    return route_repository.count_for_user(user_id)


def count_public_routes(city: str | None = None, country: str | None = None,
                        min_distance_m: float | None = None,
                        max_distance_m: float | None = None) -> int:
    return route_repository.count_public(city=city, country=country,
                                         min_distance_m=min_distance_m,
                                         max_distance_m=max_distance_m)
