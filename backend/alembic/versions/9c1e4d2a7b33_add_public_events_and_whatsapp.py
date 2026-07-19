"""add public events and whatsapp number

Revision ID: 9c1e4d2a7b33
Revises: 7f4a2b1c8d90
Create Date: 2026-02-26 12:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c1e4d2a7b33"
down_revision: Union[str, None] = "7f4a2b1c8d90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tiendas", sa.Column("whatsapp_number", sa.String(length=30), nullable=True))

    op.create_check_constraint(
        "ck_usuarios_rol_valid",
        "usuarios",
        "rol IS NULL OR rol IN ('superadmin','admin','empleado','cliente')",
    )

    op.create_table(
        "public_events",
        sa.Column("id_evento", sa.UUID(), nullable=False),
        sa.Column("id_tienda", sa.UUID(), nullable=False),
        sa.Column("id_producto", sa.UUID(), nullable=True),
        sa.Column("evento", sa.String(length=50), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["id_producto"], ["productos.id_producto"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["id_tienda"], ["tiendas.id_tienda"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_evento"),
    )
    op.create_index(op.f("ix_public_events_id_tienda"), "public_events", ["id_tienda"], unique=False)
    op.create_index(op.f("ix_public_events_fecha"), "public_events", ["fecha"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_public_events_fecha"), table_name="public_events")
    op.drop_index(op.f("ix_public_events_id_tienda"), table_name="public_events")
    op.drop_table("public_events")
    op.drop_constraint("ck_usuarios_rol_valid", "usuarios", type_="check")
    op.drop_column("tiendas", "whatsapp_number")
