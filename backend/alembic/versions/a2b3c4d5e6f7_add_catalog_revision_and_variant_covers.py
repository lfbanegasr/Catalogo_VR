"""add catalog revision and variant cover adjustments

Revision ID: a2b3c4d5e6f7
Revises: f1e2d3c4b5a6
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tiendas",
        sa.Column("catalog_revision", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("variantes_producto", sa.Column("imagen_fit", sa.String(length=12), nullable=True))
    op.add_column("variantes_producto", sa.Column("imagen_posicion_x", sa.Integer(), nullable=True))
    op.add_column("variantes_producto", sa.Column("imagen_posicion_y", sa.Integer(), nullable=True))
    op.add_column("variantes_producto", sa.Column("imagen_zoom", sa.Integer(), nullable=True))
    op.add_column("variantes_producto", sa.Column("imagen_fondo", sa.String(length=20), nullable=True))
    op.create_check_constraint(
        "ck_variantes_imagen_fit",
        "variantes_producto",
        "imagen_fit IS NULL OR imagen_fit IN ('cover', 'contain', 'auto')",
    )
    op.create_check_constraint(
        "ck_variantes_imagen_pos_x",
        "variantes_producto",
        "imagen_posicion_x IS NULL OR imagen_posicion_x BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_variantes_imagen_pos_y",
        "variantes_producto",
        "imagen_posicion_y IS NULL OR imagen_posicion_y BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_variantes_imagen_zoom",
        "variantes_producto",
        "imagen_zoom IS NULL OR imagen_zoom BETWEEN 80 AND 200",
    )


def downgrade() -> None:
    op.drop_constraint("ck_variantes_imagen_zoom", "variantes_producto", type_="check")
    op.drop_constraint("ck_variantes_imagen_pos_y", "variantes_producto", type_="check")
    op.drop_constraint("ck_variantes_imagen_pos_x", "variantes_producto", type_="check")
    op.drop_constraint("ck_variantes_imagen_fit", "variantes_producto", type_="check")
    op.drop_column("variantes_producto", "imagen_fondo")
    op.drop_column("variantes_producto", "imagen_zoom")
    op.drop_column("variantes_producto", "imagen_posicion_y")
    op.drop_column("variantes_producto", "imagen_posicion_x")
    op.drop_column("variantes_producto", "imagen_fit")
    op.drop_column("tiendas", "catalog_revision")
