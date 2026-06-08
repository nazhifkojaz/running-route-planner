from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional

from ..schemas import (
    RouteCreate,
    RouteUpdate,
    RouteOut,
    RouteListOut,
    RoutesListResponse,
)
from ..services.route_service import route_service

router = APIRouter(prefix="/routes", tags=["routes"])


def _build_list_response(routes: list[dict], total: int, limit: int, offset: int) -> RoutesListResponse:
    route_list = [RouteListOut(**r) for r in routes]
    return RoutesListResponse(
        routes=route_list,
        total=total,
        limit=limit,
        offset=offset,
        has_more=(offset + len(routes)) < total,
    )


@router.post("", response_model=RouteOut, status_code=201)
async def create_route(route: RouteCreate, request: Request):
    result = route_service.create_route(request, route)
    return RouteOut(**result)


@router.get("/me", response_model=RoutesListResponse)
async def get_my_routes(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    result = route_service.list_user_routes(request, limit=limit, offset=offset)
    return _build_list_response(result["routes"], result["total"], limit, offset)


@router.get("/explore", response_model=RoutesListResponse)
async def explore_public_routes(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    city: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    min_distance_km: Optional[float] = Query(default=None, ge=0),
    max_distance_km: Optional[float] = Query(default=None, ge=0),
):
    if min_distance_km is not None and max_distance_km is not None and min_distance_km > max_distance_km:
        raise HTTPException(422, "min_distance_km must be <= max_distance_km")

    min_distance_m = min_distance_km * 1000 if min_distance_km else None
    max_distance_m = max_distance_km * 1000 if max_distance_km else None

    result = route_service.list_public_routes(
        limit=limit, offset=offset, city=city, country=country,
        min_distance_m=min_distance_m, max_distance_m=max_distance_m,
    )
    return _build_list_response(result["routes"], result["total"], limit, offset)


@router.get("/{route_id}", response_model=RouteOut)
async def get_route(route_id: str, request: Request):
    route = route_service.get_route(request, route_id)
    return RouteOut(**route)


@router.put("/{route_id}", response_model=RouteOut)
async def update_route(route_id: str, updates: RouteUpdate, request: Request):
    result = route_service.update_route(request, route_id, updates)
    return RouteOut(**result)


@router.delete("/{route_id}", status_code=204)
async def delete_route(route_id: str, request: Request):
    route_service.delete_route(request, route_id)
    return None
