from __future__ import annotations

from typing import Callable

from fastapi import HTTPException, Request

from ..core.security import AuthenticatedUser, resolve_user
from ..repositories.route_repository import RouteRepository, route_repository
from ..schemas import RouteCreate, RouteUpdate


class RouteService:
    """Business logic facade for route operations."""

    def __init__(
        self,
        repository: RouteRepository = route_repository,
        user_resolver: Callable[[Request], AuthenticatedUser | None] = resolve_user,
    ) -> None:
        self._repository = repository
        self._user_resolver = user_resolver

    def _require_user(self, request: Request) -> AuthenticatedUser:
        user = self._user_resolver(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        return user

    def create_route(self, request: Request, payload: RouteCreate) -> dict:
        user = self._require_user(request)
        geometry = payload.geometry.model_dump() if payload.geometry else None
        return self._repository.create(
            user_id=user.id,
            username_snapshot=user.username,
            name=payload.name,
            description=payload.description,
            distance_m=payload.distance_m,
            city=payload.city,
            country=payload.country,
            elevation_gain_m=payload.elevation_gain_m,
            elevation_loss_m=payload.elevation_loss_m,
            visibility=payload.visibility,
            geometry=geometry,
        )

    def list_user_routes(self, request: Request, *, limit: int, offset: int) -> dict:
        user = self._require_user(request)
        routes = self._repository.list_for_user(user.id, limit=limit, offset=offset)
        total = self._repository.count_for_user(user.id)
        return {
            "routes": routes,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def list_public_routes(
        self,
        *,
        limit: int,
        offset: int,
        city: str | None = None,
        country: str | None = None,
        min_distance_m: float | None = None,
        max_distance_m: float | None = None,
    ) -> dict:
        routes = self._repository.list_public(
            limit=limit,
            offset=offset,
            city=city,
            country=country,
            min_distance_m=min_distance_m,
            max_distance_m=max_distance_m,
        )
        total = self._repository.count_public(
            city=city, country=country,
            min_distance_m=min_distance_m, max_distance_m=max_distance_m,
        )
        return {
            "routes": routes,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_route(self, request: Request, route_id: str) -> dict:
        route = self._repository.get(route_id)
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")

        if route["visibility"] == "private":
            user = self._user_resolver(request)
            if not user or user.id != route["user_id"]:
                raise HTTPException(status_code=403, detail="Access denied")
        return route

    def update_route(self, request: Request, route_id: str, updates: RouteUpdate) -> dict:
        user = self._require_user(request)
        update_dict = updates.model_dump(exclude_none=True)
        result = self._repository.update(route_id, user.id, update_dict)
        if not result:
            raise HTTPException(status_code=404, detail="Route not found or access denied")
        return result

    def delete_route(self, request: Request, route_id: str) -> None:
        user = self._require_user(request)
        deleted = self._repository.delete(route_id, user.id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Route not found or access denied")


route_service = RouteService()
