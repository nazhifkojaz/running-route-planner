"""Initial database schema

Revision ID: 20241013_0001
Revises: 
Create Date: 2024-10-13 00:01:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20241013_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("strava_athlete_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.Text(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("run_count_all", sa.BigInteger(), nullable=True),
        sa.Column("run_distance_all_m", sa.Float(), nullable=True),
        sa.Column("avg_pace_5_sec_per_km", sa.Float(), nullable=True),
        sa.Column("avg_hr_5", sa.Float(), nullable=True),
        sa.Column("last_run_id", sa.BigInteger(), nullable=True),
        sa.Column("cached_profile_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("cached_stats_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("cached_runs_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("secret", sa.Text(), nullable=False),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
    )

    op.create_table(
        "routes",
        sa.Column("id", sa.Text(), server_default=sa.text("gen_random_uuid()::text"), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("username_snapshot", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("country", sa.Text(), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("elevation_gain_m", sa.Float(), nullable=True),
        sa.Column("elevation_loss_m", sa.Float(), nullable=True),
        sa.Column("visibility", sa.Text(), server_default=sa.text("'private'"), nullable=False),
        sa.Column("geometry", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="routes_user_id_fkey"),
        sa.CheckConstraint("char_length(name) >= 1 AND char_length(name) <= 100", name="ck_routes_name_length"),
        sa.CheckConstraint("description IS NULL OR char_length(description) <= 500", name="ck_routes_description_length"),
        sa.CheckConstraint("city IS NULL OR char_length(city) <= 120", name="ck_routes_city_length"),
        sa.CheckConstraint("country IS NULL OR char_length(country) <= 120", name="ck_routes_country_length"),
        sa.CheckConstraint("distance_m >= 0", name="ck_routes_distance_non_negative"),
        sa.CheckConstraint("elevation_gain_m IS NULL OR elevation_gain_m >= 0", name="ck_routes_gain_non_negative"),
        sa.CheckConstraint("elevation_loss_m IS NULL OR elevation_loss_m >= 0", name="ck_routes_loss_non_negative"),
        sa.CheckConstraint("visibility IN ('private', 'public')", name="ck_routes_visibility"),
    )

    op.create_index(
        "idx_routes_user_created",
        "routes",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_routes_public_created",
        "routes",
        ["visibility", "created_at"],
        unique=False,
        postgresql_where=sa.text("visibility = 'public'"),
    )
    op.create_index(
        "idx_routes_city",
        "routes",
        ["city"],
        unique=False,
        postgresql_where=sa.text("city IS NOT NULL"),
    )
    op.create_index(
        "idx_routes_country",
        "routes",
        ["country"],
        unique=False,
        postgresql_where=sa.text("country IS NOT NULL"),
    )
    op.create_index(
        "idx_routes_geometry",
        "routes",
        ["geometry"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"geometry": "jsonb_path_ops"},
    )


def downgrade() -> None:
    op.drop_index("idx_routes_geometry", table_name="routes")
    op.drop_index("idx_routes_country", table_name="routes")
    op.drop_index("idx_routes_city", table_name="routes")
    op.drop_index("idx_routes_public_created", table_name="routes")
    op.drop_index("idx_routes_user_created", table_name="routes")
    op.drop_table("routes")
    op.drop_table("sessions")
    op.drop_table("users")
