"""add customer accounts

Revision ID: a9c3e7f1b5d2
Revises: f8a2b6c0d4e5
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9c3e7f1b5d2"
down_revision: Union[str, None] = "f8a2b6c0d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clientes", sa.Column("password_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("clientes", "password_hash")