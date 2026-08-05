"""add hierarchical categories with product compatibility

Revision ID: b4c8d2e6f0a1
Revises: 7ffb0ddfe4e1
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b4c8d2e6f0a1"
down_revision: Union[str, None] = "7ffb0ddfe4e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "categorias",
        sa.Column("id_categoria_padre", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("categorias", sa.Column("slug", sa.String(length=120), nullable=True))
    op.add_column(
        "categorias",
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "categorias",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "categorias",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_foreign_key(
        "fk_categorias_categoria_padre",
        "categorias",
        "categorias",
        ["id_categoria_padre"],
        ["id_categoria"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE categorias
        SET slug = CONCAT(
            COALESCE(
                NULLIF(
                    TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(nombre, '[^a-zA-Z0-9]+', '-', 'g'))),
                    ''
                ),
                'categoria'
            ),
            '-',
            LEFT(id_categoria::text, 8)
        )
        WHERE slug IS NULL
        """
    )
    op.alter_column("categorias", "slug", nullable=False)

    op.execute(
        "ALTER TABLE categorias "
        "DROP CONSTRAINT IF EXISTS uq_categorias_tienda_nombre"
    )
    op.create_index(
        "ix_categorias_tienda_padre_orden",
        "categorias",
        ["id_tienda", "id_categoria_padre", "orden"],
        unique=False,
    )
    op.create_index(
        "uq_categorias_raiz_tienda_nombre",
        "categorias",
        ["id_tienda", sa.text("lower(nombre)")],
        unique=True,
        postgresql_where=sa.text("id_categoria_padre IS NULL"),
    )
    op.create_index(
        "uq_categorias_hija_tienda_padre_nombre",
        "categorias",
        ["id_tienda", "id_categoria_padre", sa.text("lower(nombre)")],
        unique=True,
        postgresql_where=sa.text("id_categoria_padre IS NOT NULL"),
    )
    op.create_index(
        "uq_categorias_tienda_slug",
        "categorias",
        ["id_tienda", "slug"],
        unique=True,
    )

    op.add_column(
        "productos",
        sa.Column("id_categoria_principal", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_productos_categoria_principal",
        "productos",
        "categorias",
        ["id_categoria_principal"],
        ["id_categoria"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        UPDATE productos
        SET id_categoria_principal = id_categoria
        WHERE id_categoria_principal IS NULL
        """
    )
    op.create_index(
        "ix_productos_tienda_categoria_principal_activo",
        "productos",
        ["id_tienda", "id_categoria_principal", "activo"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_productos_tienda_categoria_principal_activo",
        table_name="productos",
    )
    op.drop_constraint(
        "fk_productos_categoria_principal",
        "productos",
        type_="foreignkey",
    )
    op.drop_column("productos", "id_categoria_principal")

    op.drop_index("uq_categorias_tienda_slug", table_name="categorias")
    op.drop_index(
        "uq_categorias_hija_tienda_padre_nombre",
        table_name="categorias",
    )
    op.drop_index("uq_categorias_raiz_tienda_nombre", table_name="categorias")
    op.drop_index("ix_categorias_tienda_padre_orden", table_name="categorias")
    op.create_unique_constraint(
        "uq_categorias_tienda_nombre",
        "categorias",
        ["id_tienda", "nombre"],
    )
    op.drop_constraint(
        "fk_categorias_categoria_padre",
        "categorias",
        type_="foreignkey",
    )
    op.drop_column("categorias", "updated_at")
    op.drop_column("categorias", "created_at")
    op.drop_column("categorias", "orden")
    op.drop_column("categorias", "slug")
    op.drop_column("categorias", "id_categoria_padre")
