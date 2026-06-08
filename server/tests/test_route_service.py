from types import SimpleNamespace
import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost/testdb")
os.environ.setdefault("SESSION_SECRET", "test-secret")

import pytest
from fastapi import HTTPException

from app.core.security import AuthenticatedUser
from app.schemas import RouteCreate
from app.services.route_service import RouteService


class CreateRecordingRepository:
    def __init__(self) -> None:
        self.last_create_payload: dict | None = None

    def create(self, **kwargs):
        self.last_create_payload = kwargs
        return {"id": "route-id"}


def test_create_route_requires_auth():
    service = RouteService(
        repository=CreateRecordingRepository(),
        user_resolver=lambda _: None,
    )

    with pytest.raises(HTTPException) as exc:
        service.create_route(
            SimpleNamespace(),
            RouteCreate(name="Morning Run", distance_m=1000),
        )

    assert exc.value.status_code == 401


def test_create_route_uses_authenticated_context():
    repo = CreateRecordingRepository()
    user = AuthenticatedUser({"id": "user-123", "username": "runner"})
    service = RouteService(repository=repo, user_resolver=lambda _: user)

    payload = RouteCreate(
        name="Morning Run",
        distance_m=5000,
        city="Paris",
        visibility="public",
    )
    result = service.create_route(SimpleNamespace(), payload)

    assert result == {"id": "route-id"}
    assert repo.last_create_payload["user_id"] == "user-123"
    assert repo.last_create_payload["username_snapshot"] == "runner"
    assert repo.last_create_payload["city"] == "Paris"
    assert repo.last_create_payload["visibility"] == "public"


def test_delete_route_propagates_not_found():
    class DeleteRepository(CreateRecordingRepository):
        def delete(self, route_id: str, user_id: str) -> bool:
            return False

    user = AuthenticatedUser({"id": "user-123"})
    service = RouteService(repository=DeleteRepository(), user_resolver=lambda _: user)

    with pytest.raises(HTTPException) as exc:
        service.delete_route(SimpleNamespace(), "route-1")

    assert exc.value.status_code == 404


def test_get_route_private_requires_owner():
    class GetRepository(CreateRecordingRepository):
        def get(self, route_id: str):
            return {"id": route_id, "user_id": "user-123", "visibility": "private"}

    service = RouteService(
        repository=GetRepository(),
        user_resolver=lambda _: None,
    )

    with pytest.raises(HTTPException) as exc:
        service.get_route(SimpleNamespace(), "route-1")

    assert exc.value.status_code == 403
