from typing import Mapping, Any

from sqlalchemy import text

from .core.security import engine

ALLOWED_USER_FIELDS = {
    "access_token", "refresh_token", "expires_at", "username", "weight_kg",
    "run_count_all", "run_distance_all_m", "avg_pace_5_sec_per_km",
    "avg_hr_5", "last_run_id", "cached_profile_at", "cached_stats_at", "cached_runs_at",
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
