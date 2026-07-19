"""add usuario activo

Revision ID: c3f7b2e9a441
Revises: 9c1e4d2a7b33
Create Date: 2026-02-27 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3f7b2e9a441"
down_revision: Union[str, None] = "9c1e4d2a7b33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("usuarios", "activo")
