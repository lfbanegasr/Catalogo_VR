"""add product cover adjustments

Revision ID: b7d4e9f2a6c1
Revises: e0c5f25f901f
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7d4e9f2a6c1"
down_revision: Union[str, None] = "e0c5f25f901f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "categorias",
        sa.Column("imagen_fit_default", sa.String(length=12), server_default="cover", nullable=False),
    )
    op.add_column(
        "categorias",
        sa.Column("imagen_posicion_x_default", sa.Integer(), server_default="50", nullable=False),
    )
    op.add_column(
        "categorias",
        sa.Column("imagen_posicion_y_default", sa.Integer(), server_default="30", nullable=False),
    )
    op.add_column(
        "categorias",
        sa.Column("imagen_zoom_default", sa.Integer(), server_default="100", nullable=False),
    )
    op.add_column("categorias", sa.Column("imagen_fondo_default", sa.String(length=20), nullable=True))
    op.create_check_constraint(
        "ck_categorias_imagen_fit_default",
        "categorias",
        "imagen_fit_default IN ('cover', 'contain', 'auto')",
    )
    op.create_check_constraint(
        "ck_categorias_imagen_pos_x_default",
        "categorias",
        "imagen_posicion_x_default BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_categorias_imagen_pos_y_default",
        "categorias",
        "imagen_posicion_y_default BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_categorias_imagen_zoom_default",
        "categorias",
        "imagen_zoom_default BETWEEN 80 AND 200",
    )

    op.add_column("productos", sa.Column("imagen_fit", sa.String(length=12), nullable=True))
    op.add_column("productos", sa.Column("imagen_posicion_x", sa.Integer(), nullable=True))
    op.add_column("productos", sa.Column("imagen_posicion_y", sa.Integer(), nullable=True))
    op.add_column("productos", sa.Column("imagen_zoom", sa.Integer(), nullable=True))
    op.add_column("productos", sa.Column("imagen_fondo", sa.String(length=20), nullable=True))
    op.create_check_constraint(
        "ck_productos_imagen_fit",
        "productos",
        "imagen_fit IS NULL OR imagen_fit IN ('cover', 'contain', 'auto')",
    )
    op.create_check_constraint(
        "ck_productos_imagen_pos_x",
        "productos",
        "imagen_posicion_x IS NULL OR imagen_posicion_x BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_productos_imagen_pos_y",
        "productos",
        "imagen_posicion_y IS NULL OR imagen_posicion_y BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_productos_imagen_zoom",
        "productos",
        "imagen_zoom IS NULL OR imagen_zoom BETWEEN 80 AND 200",
    )


def downgrade() -> None:
    op.drop_constraint("ck_productos_imagen_zoom", "productos", type_="check")
    op.drop_constraint("ck_productos_imagen_pos_y", "productos", type_="check")
    op.drop_constraint("ck_productos_imagen_pos_x", "productos", type_="check")
    op.drop_constraint("ck_productos_imagen_fit", "productos", type_="check")
    op.drop_column("productos", "imagen_fondo")
    op.drop_column("productos", "imagen_zoom")
    op.drop_column("productos", "imagen_posicion_y")
    op.drop_column("productos", "imagen_posicion_x")
    op.drop_column("productos", "imagen_fit")

    op.drop_constraint("ck_categorias_imagen_zoom_default", "categorias", type_="check")
    op.drop_constraint("ck_categorias_imagen_pos_y_default", "categorias", type_="check")
    op.drop_constraint("ck_categorias_imagen_pos_x_default", "categorias", type_="check")
    op.drop_constraint("ck_categorias_imagen_fit_default", "categorias", type_="check")
    op.drop_column("categorias", "imagen_fondo_default")
    op.drop_column("categorias", "imagen_zoom_default")
    op.drop_column("categorias", "imagen_posicion_y_default")
    op.drop_column("categorias", "imagen_posicion_x_default")
    op.drop_column("categorias", "imagen_fit_default")