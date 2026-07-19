"""add offer categories

Revision ID: f9a1b2c3d4e5
Revises: 0457213d6fe2
Create Date: 2026-02-28 10:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f9a1b2c3d4e5"
down_revision: Union[str, None] = "0457213d6fe2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oferta_categorias",
        sa.Column("id_oferta", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_categoria", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["id_oferta"], ["ofertas.id_oferta"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_categoria"], ["categorias.id_categoria"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_oferta", "id_categoria"),
        sa.UniqueConstraint("id_oferta", "id_categoria", name="uq_oferta_categorias_oferta_categoria"),
    )
    op.create_index("ix_oferta_categorias_id_categoria", "oferta_categorias", ["id_categoria"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_oferta_categorias_id_categoria", table_name="oferta_categorias")
    op.drop_table("oferta_categorias")
