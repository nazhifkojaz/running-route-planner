from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from .core.config import DATABASE_URL


def _alembic_config() -> Config:
    project_root = Path(__file__).resolve().parents[1]
    cfg = Config(str(project_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(project_root / "alembic"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    return cfg


def init_db() -> None:
    command.upgrade(_alembic_config(), "head")
