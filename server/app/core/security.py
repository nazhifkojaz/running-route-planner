from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

from itsdangerous import BadSignature, URLSafeSerializer
from fastapi import Request
from fastapi.responses import Response
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from ..core.config import DATABASE_URL, SESSION_SECRET

signer = URLSafeSerializer(SESSION_SECRET)

_engine: Engine | None = None
_engine_lock = threading.Lock()


def engine() -> Engine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
    return _engine


@dataclass(frozen=True)
class AuthenticatedUser:
    data: Mapping[str, Any]

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def get(self, key: str, default: Any | None = None) -> Any | None:
        return self.data.get(key, default)

    @property
    def id(self) -> str:
        return str(self.data["id"])

    @property
    def username(self) -> str | None:
        return self.data.get("username")

    def to_dict(self) -> dict[str, Any]:
        return dict(self.data)


def set_cookie(resp: Response, name: str, value: str, max_age: int = 86400 * 30) -> None:
    resp.set_cookie(
        name,
        value,
        max_age=max_age,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
    )


def _load_user(user_id: str) -> AuthenticatedUser | None:
    with engine().begin() as con:
        row = con.execute(
            text("SELECT * FROM users WHERE id=:id"),
            {"id": user_id},
        ).mappings().first()
    return AuthenticatedUser(dict(row)) if row else None


def _user_from_session(sid: str, secret: str) -> AuthenticatedUser | None:
    with engine().begin() as con:
        session = con.execute(
            text(
                "SELECT user_id, secret, expires_at FROM sessions WHERE id=:sid"
            ),
            {"sid": sid},
        ).mappings().first()
    if not session or session["secret"] != secret:
        return None
    if session["expires_at"] < datetime.now(timezone.utc):
        return None
    return _load_user(session["user_id"])


def user_from_cookie(request: Request) -> AuthenticatedUser | None:
    raw = request.cookies.get("sid")
    if not raw:
        return None
    try:
        sid, secret = signer.loads(raw)
    except BadSignature:
        return None
    return _user_from_session(sid, secret)


def user_from_authorization(request: Request) -> AuthenticatedUser | None:
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        sid, secret = signer.loads(token)
    except BadSignature:
        return None
    return _user_from_session(sid, secret)


def resolve_user(request: Request) -> AuthenticatedUser | None:
    return user_from_authorization(request) or user_from_cookie(request)
