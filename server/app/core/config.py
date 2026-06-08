from __future__ import annotations

from datetime import timedelta

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_pg_url(url: str) -> str:
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Settings(BaseSettings):
    frontend_origin: str = Field(
        default="https://nazhifkojaz.github.io/running-route-planner/",
        alias="FRONTEND_ORIGIN",
    )
    database_url: str = Field(..., alias="DATABASE_URL")
    strava_client_id: str | None = Field(default=None, alias="STRAVA_CLIENT_ID")
    strava_client_secret: str | None = Field(default=None, alias="STRAVA_CLIENT_SECRET")
    strava_redirect_url: str | None = Field(default=None, alias="STRAVA_REDIRECT_URL")
    session_secret: str = Field(default="dev-secret-change-me", alias="SESSION_SECRET")

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        return normalize_pg_url(value)


try:
    settings = Settings()
except ValidationError as exc:
    raise RuntimeError("Invalid environment configuration") from exc

FRONTEND_ORIGIN = settings.frontend_origin
DATABASE_URL = settings.database_url
STRAVA_CLIENT_ID = settings.strava_client_id
STRAVA_CLIENT_SECRET = settings.strava_client_secret
STRAVA_REDIRECT_URL = settings.strava_redirect_url
SESSION_SECRET = settings.session_secret

CORS_ALLOW_ORIGINS = [FRONTEND_ORIGIN, "http://localhost:5173"]

PROFILE_TTL = timedelta(hours=24)
STATS_TTL = timedelta(hours=12)
RUNS_TTL = timedelta(hours=3)
