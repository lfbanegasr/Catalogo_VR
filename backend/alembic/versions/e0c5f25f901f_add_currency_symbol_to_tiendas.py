"""add currency_symbol to tiendas

Revision ID: e0c5f25f901f
Revises: a9c3e7f1b5d2
Create Date: 2026-08-10 03:11:38.126511
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e0c5f25f901f'
down_revision: Union[str, None] = 'a9c3e7f1b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tiendas', sa.Column('currency_symbol', sa.String(length=10), nullable=False, server_default='S/'))


def downgrade() -> None:
    op.drop_column('tiendas', 'currency_symbol')
