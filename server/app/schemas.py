# app/schemas.py
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Literal, Any


class _StravaDataBase(BaseModel):
    strava_athlete_id: int | None = None
    username: str | None = None
    weight_kg: float | None = None
    run_count_all: int | None = None
    run_distance_all_m: float | None = None
    avg_pace_5_sec_per_km: float | None = None
    avg_hr_5: float | None = None
    cached_profile_at: datetime | None = None
    cached_stats_at: datetime | None = None
    cached_runs_at: datetime | None = None


class MeOut(_StravaDataBase):
    connected: bool


class SyncOut(_StravaDataBase):
    ok: bool


# ========== NEW: Route schemas ==========

class GeoJSONGeometry(BaseModel):
    """GeoJSON LineString geometry"""
    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]  # [[lon, lat], [lon, lat], ...]
    properties: dict[str, Any] | None = None  # Can store waypoints here

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v):
        if not v or len(v) < 2:
            raise ValueError("LineString must have at least 2 coordinates")
        for coord in v:
            if not isinstance(coord, list) or len(coord) < 2:
                raise ValueError("Each coordinate must be [lon, lat]")
            lon, lat = coord[0], coord[1]
            if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
                raise ValueError(f"Invalid coordinates: lon={lon}, lat={lat}")
        return v


class RouteCreate(BaseModel):
    """Create a new route"""
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    distance_m: float = Field(gt=0)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    elevation_gain_m: float | None = Field(default=None, ge=0)
    elevation_loss_m: float | None = Field(default=None, ge=0)
    visibility: Literal["private", "public"] = "private"
    geometry: GeoJSONGeometry | None = None


class RouteUpdate(BaseModel):
    """Update an existing route"""
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    elevation_gain_m: float | None = Field(default=None, ge=0)
    elevation_loss_m: float | None = Field(default=None, ge=0)
    visibility: Literal["private", "public"] | None = None


class RouteOut(BaseModel):
    """Route response"""
    id: str
    user_id: str
    username_snapshot: str | None = None
    name: str
    description: str | None = None
    distance_m: float
    city: str | None = None
    country: str | None = None
    elevation_gain_m: float | None = None
    elevation_loss_m: float | None = None
    visibility: Literal["private", "public"]
    geometry: dict[str, Any] | None = None  # GeoJSON object
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RouteListOut(BaseModel):
    """Route list item (without full geometry for performance)"""
    id: str
    user_id: str
    username_snapshot: str | None = None
    name: str
    description: str | None = None
    distance_m: float
    city: str | None = None
    country: str | None = None
    elevation_gain_m: float | None = None
    elevation_loss_m: float | None = None
    visibility: Literal["private", "public"]
    created_at: datetime
    has_geometry: bool = False

    model_config = ConfigDict(from_attributes=True)


class RoutesListResponse(BaseModel):
    """Paginated routes response"""
    routes: list[RouteListOut]
    total: int
    limit: int
    offset: int
    has_more: bool
