"""add customer addresses and order tracking

Revision ID: e7f1a5b9c3d4
Revises: d6e0f4a8b2c3
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e7f1a5b9c3d4"
down_revision: Union[str, None] = "d6e0f4a8b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clientes", sa.Column("email", sa.String(length=150), nullable=True))
    op.add_column("clientes", sa.Column("notas", sa.Text(), nullable=True))
    op.add_column(
        "clientes",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_clientes_tienda_telefono",
        "clientes",
        ["id_tienda", "telefono"],
    )
    op.create_index(
        "ix_clientes_tienda_email",
        "clientes",
        ["id_tienda", "email"],
    )
    op.execute(
        """
        UPDATE clientes
        SET telefono = NULLIF(regexp_replace(telefono, '[^0-9]', '', 'g'), '')
        WHERE telefono IS NOT NULL
        """,
    )

    op.create_table(
        "direcciones_cliente",
        sa.Column("id_direccion", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_tienda", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_cliente", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("etiqueta", sa.String(length=50), nullable=False, server_default="Principal"),
        sa.Column("destinatario", sa.String(length=150), nullable=False),
        sa.Column("telefono", sa.String(length=20), nullable=True),
        sa.Column("linea1", sa.String(length=255), nullable=False),
        sa.Column("linea2", sa.String(length=255), nullable=True),
        sa.Column("ciudad", sa.String(length=100), nullable=False),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("referencia", sa.String(length=255), nullable=True),
        sa.Column("latitud", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitud", sa.Numeric(10, 7), nullable=True),
        sa.Column("es_predeterminada", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
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
            ["id_cliente"],
            ["clientes.id_cliente"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_direccion"),
    )
    op.create_index(
        "ix_direcciones_cliente_activas",
        "direcciones_cliente",
        ["id_cliente", "activa"],
    )
    op.create_index(
        "uq_direcciones_cliente_predeterminada",
        "direcciones_cliente",
        ["id_cliente"],
        unique=True,
        postgresql_where=sa.text("es_predeterminada IS TRUE"),
    )

    op.add_column(
        "ventas",
        sa.Column("codigo_seguimiento", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "ventas",
        sa.Column(
            "metodo_entrega",
            sa.String(length=30),
            nullable=False,
            server_default="retiro",
        ),
    )
    op.add_column("ventas", sa.Column("metodo_pago", sa.String(length=30), nullable=True))
    op.add_column("ventas", sa.Column("notas_cliente", sa.Text(), nullable=True))
    op.add_column(
        "ventas",
        sa.Column(
            "direccion_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "ventas",
        sa.Column(
            "fecha_actualizacion",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.execute(
        """
        UPDATE ventas
        SET codigo_seguimiento = upper(substr(replace(id_venta::text, '-', ''), 1, 12))
        WHERE codigo_seguimiento IS NULL
        """,
    )
    op.alter_column("ventas", "codigo_seguimiento", nullable=False)
    op.create_index(
        "uq_ventas_codigo_seguimiento",
        "ventas",
        ["codigo_seguimiento"],
        unique=True,
    )

    op.create_table(
        "historial_estados_pedido",
        sa.Column("id_evento", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_venta", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id_usuario", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("estado_anterior", sa.String(length=50), nullable=True),
        sa.Column("estado_nuevo", sa.String(length=50), nullable=False),
        sa.Column("nota", sa.String(length=500), nullable=True),
        sa.Column("visible_cliente", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "fecha_evento",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["id_venta"],
            ["ventas.id_venta"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario"],
            ["usuarios.id_usuario"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id_evento"),
    )
    op.create_index(
        "ix_historial_pedido_fecha",
        "historial_estados_pedido",
        ["id_venta", "fecha_evento"],
    )
    op.execute(
        """
        INSERT INTO historial_estados_pedido
            (id_evento, id_venta, estado_anterior, estado_nuevo, nota, visible_cliente, fecha_evento)
        SELECT
            id_venta,
            id_venta,
            NULL,
            estado,
            'Estado importado del historial existente',
            TRUE,
            COALESCE(fecha_venta, CURRENT_TIMESTAMP)
        FROM ventas
        """,
    )


def downgrade() -> None:
    op.drop_index("ix_historial_pedido_fecha", table_name="historial_estados_pedido")
    op.drop_table("historial_estados_pedido")
    op.drop_index("uq_ventas_codigo_seguimiento", table_name="ventas")
    op.drop_column("ventas", "fecha_actualizacion")
    op.drop_column("ventas", "direccion_snapshot")
    op.drop_column("ventas", "notas_cliente")
    op.drop_column("ventas", "metodo_pago")
    op.drop_column("ventas", "metodo_entrega")
    op.drop_column("ventas", "codigo_seguimiento")
    op.drop_index(
        "uq_direcciones_cliente_predeterminada",
        table_name="direcciones_cliente",
    )
    op.drop_index("ix_direcciones_cliente_activas", table_name="direcciones_cliente")
    op.drop_table("direcciones_cliente")
    op.drop_index("ix_clientes_tienda_email", table_name="clientes")
    op.drop_index("ix_clientes_tienda_telefono", table_name="clientes")
    op.drop_column("clientes", "updated_at")
    op.drop_column("clientes", "notas")
    op.drop_column("clientes", "email")
