"""add offers and themes

Revision ID: e8f1c2d3b4a5
Revises: d1a2b3c4e5f6
Create Date: 2026-02-27 20:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e8f1c2d3b4a5"
down_revision: Union[str, None] = "d1a2b3c4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


offer_type_enum = sa.Enum("PERCENT", "PRICE_OVERRIDE", name="offer_type_enum", native_enum=False)


def upgrade() -> None:
    op.add_column(
        "tiendas",
        sa.Column("theme_id", sa.String(length=50), nullable=False, server_default="default"),
    )
    op.add_column(
        "tiendas",
        sa.Column("theme_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.create_table(
        "ofertas",
        sa.Column("id_oferta", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_tienda", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("tipo", offer_type_enum, nullable=False),
        sa.Column("porcentaje", sa.Numeric(10, 2), nullable=True),
        sa.Column("prioridad", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha_inicio", sa.DateTime(), nullable=True),
        sa.Column("fecha_fin", sa.DateTime(), nullable=True),
        sa.Column("banner_url", sa.String(length=255), nullable=True),
        sa.Column("badge_text", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["id_tienda"], ["tiendas.id_tienda"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_oferta"),
    )
    op.create_index(op.f("ix_ofertas_id_tienda"), "ofertas", ["id_tienda"], unique=False)

    op.create_table(
        "oferta_productos",
        sa.Column("id_oferta", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_producto", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("precio_override", sa.Numeric(10, 2), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["id_oferta"], ["ofertas.id_oferta"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_producto"], ["productos.id_producto"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_oferta", "id_producto"),
        sa.UniqueConstraint("id_oferta", "id_producto", name="uq_oferta_productos_oferta_producto"),
    )

    op.alter_column("tiendas", "theme_id", server_default=None)


def downgrade() -> None:
    op.drop_table("oferta_productos")
    op.drop_index(op.f("ix_ofertas_id_tienda"), table_name="ofertas")
    op.drop_table("ofertas")
    op.drop_column("tiendas", "theme_config")
    op.drop_column("tiendas", "theme_id")
