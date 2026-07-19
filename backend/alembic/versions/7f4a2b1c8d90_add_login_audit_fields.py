"""add login audit fields

Revision ID: 7f4a2b1c8d90
Revises: 5d2b0c9f4e11
Create Date: 2026-02-26 02:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f4a2b1c8d90"
down_revision: Union[str, None] = "5d2b0c9f4e11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "audit_logs",
        sa.Column("evento", sa.String(length=50), nullable=False, server_default="request"),
    )
    op.add_column("audit_logs", sa.Column("exito", sa.Boolean(), nullable=True))
    op.add_column("audit_logs", sa.Column("email_intentado", sa.String(length=150), nullable=True))
    op.add_column("audit_logs", sa.Column("detalle", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "detalle")
    op.drop_column("audit_logs", "email_intentado")
    op.drop_column("audit_logs", "exito")
    op.drop_column("audit_logs", "evento")
