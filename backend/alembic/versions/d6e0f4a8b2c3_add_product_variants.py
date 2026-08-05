"""add product variants and variant-aware sales

Revision ID: d6e0f4a8b2c3
Revises: c5d9e3f7a1b2
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d6e0f4a8b2c3"
down_revision: Union[str, None] = "c5d9e3f7a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "variantes_producto",
        sa.Column("id_variante", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_tienda", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_producto", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("precio_venta", sa.Numeric(10, 2), nullable=True),
        sa.Column("costo_adquisicion", sa.Numeric(10, 2), nullable=True),
        sa.Column("stock_actual", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imagen_url", sa.String(length=255), nullable=True),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "es_predeterminada",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["id_tienda"],
            ["tiendas.id_tienda"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_producto"],
            ["productos.id_producto"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_variante"),
        sa.UniqueConstraint("id_tienda", "sku", name="uq_variantes_tienda_sku"),
    )
    op.create_index(
        "ix_variantes_producto_activa",
        "variantes_producto",
        ["id_producto", "activa"],
    )
    op.create_index(
        "ix_variantes_tienda_stock",
        "variantes_producto",
        ["id_tienda", "stock_actual"],
    )
    op.create_index(
        "uq_variantes_producto_predeterminada",
        "variantes_producto",
        ["id_producto"],
        unique=True,
        postgresql_where=sa.text("es_predeterminada IS TRUE"),
    )

    op.create_table(
        "variante_atributos",
        sa.Column("id_variante", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_atributo", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_opcion", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["id_variante"],
            ["variantes_producto.id_variante"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_atributo"],
            ["atributos.id_atributo"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_opcion"],
            ["atributo_opciones.id_opcion"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id_variante", "id_atributo"),
    )

    op.add_column(
        "detalle_ventas",
        sa.Column("id_variante", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "detalle_ventas",
        sa.Column("sku_variante", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "detalle_ventas",
        sa.Column("nombre_variante", sa.String(length=255), nullable=True),
    )
    op.create_foreign_key(
        "fk_detalle_ventas_variante",
        "detalle_ventas",
        "variantes_producto",
        ["id_variante"],
        ["id_variante"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_detalle_ventas_id_variante",
        "detalle_ventas",
        ["id_variante"],
    )


def downgrade() -> None:
    op.drop_index("ix_detalle_ventas_id_variante", table_name="detalle_ventas")
    op.drop_constraint(
        "fk_detalle_ventas_variante",
        "detalle_ventas",
        type_="foreignkey",
    )
    op.drop_column("detalle_ventas", "nombre_variante")
    op.drop_column("detalle_ventas", "sku_variante")
    op.drop_column("detalle_ventas", "id_variante")
    op.drop_table("variante_atributos")
    op.drop_index(
        "uq_variantes_producto_predeterminada",
        table_name="variantes_producto",
    )
    op.drop_index("ix_variantes_tienda_stock", table_name="variantes_producto")
    op.drop_index("ix_variantes_producto_activa", table_name="variantes_producto")
    op.drop_table("variantes_producto")
