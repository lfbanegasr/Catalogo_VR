"""add product sets and inventory consumption snapshots

Revision ID: f1e2d3c4b5a6
Revises: b7d4e9f2a6c1
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, None] = "b7d4e9f2a6c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("categorias", sa.Column("codigo_sistema", sa.String(length=30), nullable=True))
    op.create_unique_constraint(
        "uq_categorias_tienda_codigo_sistema",
        "categorias",
        ["id_tienda", "codigo_sistema"],
    )
    op.add_column(
        "productos",
        sa.Column("tipo_producto", sa.String(length=10), nullable=False, server_default="SIMPLE"),
    )
    op.create_check_constraint(
        "ck_productos_tipo_producto",
        "productos",
        "tipo_producto IN ('SIMPLE', 'SET')",
    )

    op.create_table(
        "producto_componentes",
        sa.Column("id_componente", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_set", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_producto_componente", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_variante_componente", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cantidad", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("cantidad > 0", name="ck_producto_componentes_cantidad_positiva"),
        sa.CheckConstraint("id_set <> id_producto_componente", name="ck_producto_componentes_no_autoreferencia"),
        sa.ForeignKeyConstraint(["id_set"], ["productos.id_producto"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_producto_componente"], ["productos.id_producto"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_variante_componente"], ["variantes_producto.id_variante"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_componente"),
    )
    op.create_index("ix_producto_componentes_id_set", "producto_componentes", ["id_set"])
    op.create_index("ix_producto_componentes_id_producto_componente", "producto_componentes", ["id_producto_componente"])
    op.create_index("ix_producto_componentes_id_variante_componente", "producto_componentes", ["id_variante_componente"])
    op.create_index(
        "uq_producto_componentes_set_producto_simple",
        "producto_componentes",
        ["id_set", "id_producto_componente"],
        unique=True,
        postgresql_where=sa.text("id_variante_componente IS NULL"),
    )
    op.create_index(
        "uq_producto_componentes_set_variante",
        "producto_componentes",
        ["id_set", "id_variante_componente"],
        unique=True,
        postgresql_where=sa.text("id_variante_componente IS NOT NULL"),
    )

    op.create_table(
        "detalle_venta_consumos",
        sa.Column("id_consumo", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_detalle", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_producto_componente", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_variante_componente", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("nombre_producto", sa.String(length=150), nullable=False),
        sa.Column("sku_variante", sa.String(length=100), nullable=True),
        sa.Column("nombre_variante", sa.String(length=255), nullable=True),
        sa.Column("costo_unitario", sa.Numeric(10, 2), nullable=True),
        sa.CheckConstraint("cantidad > 0", name="ck_detalle_venta_consumos_cantidad_positiva"),
        sa.ForeignKeyConstraint(["id_detalle"], ["detalle_ventas.id_detalle"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_producto_componente"], ["productos.id_producto"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_variante_componente"], ["variantes_producto.id_variante"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_consumo"),
    )
    op.create_index("ix_detalle_venta_consumos_id_detalle", "detalle_venta_consumos", ["id_detalle"])
    op.create_index("ix_detalle_venta_consumos_id_producto_componente", "detalle_venta_consumos", ["id_producto_componente"])
    op.create_index("ix_detalle_venta_consumos_id_variante_componente", "detalle_venta_consumos", ["id_variante_componente"])


def downgrade() -> None:
    op.drop_table("detalle_venta_consumos")
    op.drop_table("producto_componentes")
    op.drop_constraint("ck_productos_tipo_producto", "productos", type_="check")
    op.drop_column("productos", "tipo_producto")
    op.drop_constraint("uq_categorias_tienda_codigo_sistema", "categorias", type_="unique")
    op.drop_column("categorias", "codigo_sistema")
