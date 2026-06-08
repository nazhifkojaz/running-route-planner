from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Sequence

from sqlalchemy import text
from sqlalchemy.engine import Engine, RowMapping

from ..core.security import engine


ROUTE_COLUMNS = """\
    id, user_id, username_snapshot, name, description,
    distance_m, city, country,
    elevation_gain_m, elevation_loss_m,
    visibility, geometry, created_at, updated_at"""

ROUTE_LIST_COLUMNS = """\
    id, user_id, username_snapshot, name, description,
    distance_m, city, country,
    elevation_gain_m, elevation_loss_m,
    visibility, geometry IS NOT NULL AS has_geometry,
    created_at, updated_at"""


def _materialize(row: RowMapping | None) -> dict | None:
    return dict(row) if row else None


def _materialize_many(rows: Sequence[RowMapping]) -> list[dict]:
    return [dict(r) for r in rows]


def _public_filters(
    city: str | None, country: str | None,
    min_distance_m: float | None, max_distance_m: float | None,
) -> tuple[list[str], dict[str, Any]]:
    conditions: list[str] = ["visibility='public'"]
    params: dict[str, Any] = {}
    if city:
        conditions.append("city ILIKE :city")
        params["city"] = f"%{city}%"
    if country:
        conditions.append("country ILIKE :country")
        params["country"] = f"%{country}%"
    if min_distance_m is not None:
        conditions.append("distance_m >= :min_dist")
        params["min_dist"] = min_distance_m
    if max_distance_m is not None:
        conditions.append("distance_m <= :max_dist")
        params["max_dist"] = max_distance_m
    return conditions, params


@dataclass
class RouteRepository:
    engine_factory: Callable[[], Engine] = engine

    def create(self, *, user_id: str, username_snapshot: str | None, name: str,
               distance_m: float, city: str | None = None, country: str | None = None,
               elevation_gain_m: float | None = None, elevation_loss_m: float | None = None,
               description: str | None = None, visibility: str = "private",
               geometry: dict | None = None) -> dict:
        payload = dict(
            uid=user_id, uname=username_snapshot, name=name, desc=description,
            dist=distance_m, city=city, country=country,
            elev_gain=elevation_gain_m, elev_loss=elevation_loss_m,
            vis=visibility, geom=json.dumps(geometry) if geometry else None,
        )
        with self.engine_factory().begin() as con:
            row = con.execute(text(f"""
                INSERT INTO routes (
                    user_id, username_snapshot, name, description,
                    distance_m, city, country,
                    elevation_gain_m, elevation_loss_m,
                    visibility, geometry
                ) VALUES (
                    :uid, :uname, :name, :desc,
                    :dist, :city, :country,
                    :elev_gain, :elev_loss,
                    :vis, CAST(:geom AS JSONB)
                )
                RETURNING {ROUTE_COLUMNS}
            """), payload).mappings().first()
        result = _materialize(row)
        assert result is not None
        return result

    def get(self, route_id: str) -> dict | None:
        with self.engine_factory().begin() as con:
            row = con.execute(text(f"""
                SELECT {ROUTE_COLUMNS}
                FROM routes WHERE id=:rid
            """), {"rid": route_id}).mappings().first()
        return _materialize(row)

    def update(self, route_id: str, user_id: str, updates: Mapping[str, Any]) -> dict | None:
        if not updates:
            return None
        allowed_fields = {
            "name", "description", "city", "country",
            "elevation_gain_m", "elevation_loss_m", "visibility",
        }
        filtered = {k: v for k, v in updates.items() if k in allowed_fields}
        if not filtered:
            return None
        set_clause = ", ".join([f"{k}=:{k}" for k in filtered.keys()])
        params = dict(filtered)
        params["rid"] = route_id
        params["uid"] = user_id
        with self.engine_factory().begin() as con:
            row = con.execute(text(f"""
                UPDATE routes SET {set_clause}, updated_at=NOW()
                WHERE id=:rid AND user_id=:uid
                RETURNING {ROUTE_COLUMNS}
            """), params).mappings().first()
        return _materialize(row)

    def delete(self, route_id: str, user_id: str) -> bool:
        with self.engine_factory().begin() as con:
            result = con.execute(text(
                "DELETE FROM routes WHERE id=:rid AND user_id=:uid"
            ), {"rid": route_id, "uid": user_id})
        return result.rowcount > 0

    def list_for_user(self, user_id: str, *, limit: int, offset: int) -> list[dict]:
        with self.engine_factory().begin() as con:
            rows = con.execute(text(f"""
                SELECT {ROUTE_LIST_COLUMNS}
                FROM routes WHERE user_id=:uid
                ORDER BY created_at DESC LIMIT :lim OFFSET :off
            """), {"uid": user_id, "lim": limit, "off": offset}).mappings().all()
        return _materialize_many(rows)

    def list_public(self, *, limit: int, offset: int,
                    city: str | None = None, country: str | None = None,
                    min_distance_m: float | None = None,
                    max_distance_m: float | None = None) -> list[dict]:
        conditions, params = _public_filters(city, country, min_distance_m, max_distance_m)
        params["lim"] = limit
        params["off"] = offset
        where_clause = " AND ".join(conditions)
        with self.engine_factory().begin() as con:
            rows = con.execute(text(f"""
                SELECT {ROUTE_LIST_COLUMNS}
                FROM routes WHERE {where_clause}
                ORDER BY created_at DESC LIMIT :lim OFFSET :off
            """), params).mappings().all()
        return _materialize_many(rows)

    def count_for_user(self, user_id: str) -> int:
        with self.engine_factory().begin() as con:
            row = con.execute(text(
                "SELECT COUNT(*) AS cnt FROM routes WHERE user_id=:uid"
            ), {"uid": user_id}).mappings().first()
        return int(row["cnt"]) if row else 0

    def count_public(self, *, city: str | None = None, country: str | None = None,
                     min_distance_m: float | None = None,
                     max_distance_m: float | None = None) -> int:
        conditions, params = _public_filters(city, country, min_distance_m, max_distance_m)
        where_clause = " AND ".join(conditions)
        with self.engine_factory().begin() as con:
            row = con.execute(text(
                f"SELECT COUNT(*) AS cnt FROM routes WHERE {where_clause}"
            ), params).mappings().first()
        return int(row["cnt"]) if row else 0


route_repository = RouteRepository()
