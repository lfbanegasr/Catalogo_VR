"""add tenant-scoped dynamic catalog attributes

Revision ID: c5d9e3f7a1b2
Revises: b4c8d2e6f0a1
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c5d9e3f7a1b2"
down_revision: Union[str, None] = "b4c8d2e6f0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    attribute_type = sa.Enum(
        "TEXT",
        "NUMBER",
        "BOOLEAN",
        "OPTION",
        name="attribute_data_type_enum",
        native_enum=False,
    )
    op.create_table(
        "atributos",
        sa.Column("id_atributo", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_tienda", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("codigo", sa.String(length=100), nullable=False),
        sa.Column("tipo_dato", attribute_type, nullable=False),
        sa.Column("unidad", sa.String(length=30), nullable=True),
        sa.Column(
            "permite_multiples",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "usable_en_variantes",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.PrimaryKeyConstraint("id_atributo"),
        sa.UniqueConstraint(
            "id_tienda",
            "codigo",
            name="uq_atributos_tienda_codigo",
        ),
    )
    op.create_index(
        "ix_atributos_tienda_activo",
        "atributos",
        ["id_tienda", "activo"],
    )

    op.create_table(
        "atributo_opciones",
        sa.Column("id_opcion", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_atributo", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("valor", sa.String(length=120), nullable=False),
        sa.Column("valor_normalizado", sa.String(length=120), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["id_atributo"],
            ["atributos.id_atributo"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_opcion"),
        sa.UniqueConstraint(
            "id_atributo",
            "valor_normalizado",
            name="uq_atributo_opciones_atributo_valor",
        ),
    )

    op.create_table(
        "categoria_atributos",
        sa.Column("id_categoria", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_atributo", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "requerido",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "filtrable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "usado_en_variantes",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["id_categoria"],
            ["categorias.id_categoria"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_atributo"],
            ["atributos.id_atributo"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_categoria", "id_atributo"),
    )
    op.create_index(
        "ix_categoria_atributos_categoria_orden",
        "categoria_atributos",
        ["id_categoria", "orden"],
    )

    op.create_table(
        "producto_atributos",
        sa.Column(
            "id_producto_atributo",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("id_producto", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_atributo", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_opcion", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("valor_texto", sa.Text(), nullable=True),
        sa.Column("valor_numero", sa.Numeric(18, 4), nullable=True),
        sa.Column("valor_booleano", sa.Boolean(), nullable=True),
        sa.CheckConstraint(
            "num_nonnulls(id_opcion, valor_texto, valor_numero, valor_booleano) = 1",
            name="ck_producto_atributos_un_valor",
        ),
        sa.ForeignKeyConstraint(
            ["id_producto"],
            ["productos.id_producto"],
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
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_producto_atributo"),
        sa.UniqueConstraint(
            "id_producto",
            "id_atributo",
            "id_opcion",
            name="uq_producto_atributos_producto_atributo_opcion",
        ),
    )
    op.create_index(
        "ix_producto_atributos_producto_atributo",
        "producto_atributos",
        ["id_producto", "id_atributo"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_producto_atributos_producto_atributo",
        table_name="producto_atributos",
    )
    op.drop_table("producto_atributos")
    op.drop_index(
        "ix_categoria_atributos_categoria_orden",
        table_name="categoria_atributos",
    )
    op.drop_table("categoria_atributos")
    op.drop_table("atributo_opciones")
    op.drop_index("ix_atributos_tienda_activo", table_name="atributos")
    op.drop_table("atributos")
