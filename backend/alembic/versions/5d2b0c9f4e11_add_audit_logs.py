"""add audit logs

Revision ID: 5d2b0c9f4e11
Revises: 44a86e37df96
Create Date: 2026-02-26 01:15:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5d2b0c9f4e11"
down_revision: Union[str, None] = "44a86e37df96"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("id_usuario", sa.UUID(), nullable=True),
        sa.Column("email_usuario", sa.String(length=150), nullable=True),
        sa.Column("id_tienda", sa.UUID(), nullable=True),
        sa.Column("accion", sa.String(length=120), nullable=False),
        sa.Column("endpoint", sa.String(length=255), nullable=False),
        sa.Column("metodo_http", sa.String(length=10), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("fecha_hora", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_fecha_hora"), "audit_logs", ["fecha_hora"], unique=False)
    op.create_index(op.f("ix_audit_logs_id_tienda"), "audit_logs", ["id_tienda"], unique=False)
    op.create_index(op.f("ix_audit_logs_id_usuario"), "audit_logs", ["id_usuario"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_id_usuario"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_id_tienda"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_fecha_hora"), table_name="audit_logs")
    op.drop_table("audit_logs")
