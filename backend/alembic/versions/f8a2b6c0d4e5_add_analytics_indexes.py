"""add analytics query indexes

Revision ID: f8a2b6c0d4e5
Revises: e7f1a5b9c3d4
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f8a2b6c0d4e5"
down_revision: Union[str, None] = "e7f1a5b9c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_public_events_tienda_evento_fecha",
        "public_events",
        ["id_tienda", "evento", "fecha"],
    )
    op.create_index(
        "ix_public_events_producto_evento_fecha",
        "public_events",
        ["id_producto", "evento", "fecha"],
    )
    op.create_index(
        "ix_ventas_tienda_origen_fecha",
        "ventas",
        ["id_tienda", "origen", "fecha_venta"],
    )


def downgrade() -> None:
    op.drop_index("ix_ventas_tienda_origen_fecha", table_name="ventas")
    op.drop_index(
        "ix_public_events_producto_evento_fecha",
        table_name="public_events",
    )
    op.drop_index(
        "ix_public_events_tienda_evento_fecha",
        table_name="public_events",
    )
