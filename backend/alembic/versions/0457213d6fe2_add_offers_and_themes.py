"""add offers and themes

Revision ID: 0457213d6fe2
Revises: e8f1c2d3b4a5
Create Date: 2026-02-27 20:02:34.450522
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0457213d6fe2'
down_revision: Union[str, None] = 'e8f1c2d3b4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
