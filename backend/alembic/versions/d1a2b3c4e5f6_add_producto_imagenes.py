"""add producto imagenes

Revision ID: d1a2b3c4e5f6
Revises: c3f7b2e9a441
Create Date: 2026-02-27 23:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d1a2b3c4e5f6"
down_revision: Union[str, None] = "c3f7b2e9a441"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "producto_imagenes",
        sa.Column(
            "id_imagen",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "id_producto",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("productos.id_producto", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("imagen_url", sa.String(length=255), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_producto_imagenes_id_producto",
        "producto_imagenes",
        ["id_producto"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_producto_imagenes_id_producto", table_name="producto_imagenes")
    op.drop_table("producto_imagenes")
