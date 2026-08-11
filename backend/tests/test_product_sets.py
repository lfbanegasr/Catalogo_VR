import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.database import Base
from crud.crud_sales import create_venta, update_venta_estado
from models import (
    Categoria,
    Cliente,
    DetalleVenta,
    DetalleVentaConsumo,
    HistorialEstadoPedido,
    Producto,
    ProductoComponente,
    Tienda,
    VarianteProducto,
    VarianteAtributo,
    Venta,
)
from models.sales import EstadoVenta
from schemas.sales_schema import DetalleVentaCreate, VentaCreate

from crud.crud_product_sets import (
    PRODUCT_TYPE_SET,
    calculate_set_stock_map,
)
from schemas.catalog_schema import ProductoComponenteIn, ProductoCreate


class TestProductSets(unittest.TestCase):
    def test_set_schema_accepts_fixed_components(self):
        first_product = uuid4()
        second_product = uuid4()
        variant_id = uuid4()

        payload = ProductoCreate(
            nombre="Set Pandora",
            precio_venta=Decimal("450.00"),
            tipo_producto=PRODUCT_TYPE_SET,
            componentes=[
                ProductoComponenteIn(
                    id_producto_componente=first_product,
                    id_variante_componente=variant_id,
                    cantidad=1,
                ),
                ProductoComponenteIn(
                    id_producto_componente=second_product,
                    cantidad=1,
                ),
            ],
        )

        self.assertEqual(payload.tipo_producto, PRODUCT_TYPE_SET)
        self.assertEqual(len(payload.componentes), 2)
        self.assertEqual(payload.componentes[0].id_variante_componente, variant_id)

    def test_component_quantity_must_be_positive(self):
        with self.assertRaises(ValidationError):
            ProductoComponenteIn(
                id_producto_componente=uuid4(),
                cantidad=0,
            )

    def test_simple_products_remain_backward_compatible(self):
        payload = ProductoCreate(
            nombre="Anillo",
            precio_venta=Decimal("100.00"),
            stock_actual=4,
        )

        self.assertEqual(payload.tipo_producto, "SIMPLE")
        self.assertEqual(payload.componentes, [])
        self.assertEqual(payload.stock_actual, 4)

    def test_set_stock_is_limited_by_scarcest_component(self):
        set_id = uuid4()
        ring_id = uuid4()
        necklace_id = uuid4()
        ring = SimpleNamespace(
            id_producto=ring_id,
            activo=True,
            tipo_producto="SIMPLE",
            stock_actual=8,
        )
        necklace = SimpleNamespace(
            id_producto=necklace_id,
            activo=True,
            tipo_producto="SIMPLE",
            stock_actual=5,
        )
        rows = [
            SimpleNamespace(
                id_set=set_id,
                id_producto_componente=ring_id,
                id_variante_componente=None,
                cantidad=2,
                producto_componente=ring,
                variante_componente=None,
            ),
            SimpleNamespace(
                id_set=set_id,
                id_producto_componente=necklace_id,
                id_variante_componente=None,
                cantidad=1,
                producto_componente=necklace,
                variante_componente=None,
            ),
        ]

        component_query = MagicMock()
        component_query.options.return_value.filter.return_value.all.return_value = rows
        variant_query = MagicMock()
        variant_query.filter.return_value.distinct.return_value.all.return_value = []
        db = MagicMock()
        db.query.side_effect = [component_query, variant_query]

        result = calculate_set_stock_map(db, [set_id])

        self.assertEqual(result[set_id], 4)

    def test_inactive_component_makes_set_unavailable(self):
        set_id = uuid4()
        product_id = uuid4()
        product = SimpleNamespace(
            id_producto=product_id,
            activo=False,
            tipo_producto="SIMPLE",
            stock_actual=10,
        )
        row = SimpleNamespace(
            id_set=set_id,
            id_producto_componente=product_id,
            id_variante_componente=None,
            cantidad=1,
            producto_componente=product,
            variante_componente=None,
        )
        component_query = MagicMock()
        component_query.options.return_value.filter.return_value.all.return_value = [row]
        variant_query = MagicMock()
        variant_query.filter.return_value.distinct.return_value.all.return_value = []
        db = MagicMock()
        db.query.side_effect = [component_query, variant_query]

        result = calculate_set_stock_map(db, [set_id])

        self.assertEqual(result[set_id], 0)

    def test_set_sale_decrements_and_cancellation_restores_components(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(
            engine,
            tables=[
                Tienda.__table__,
                Categoria.__table__,
                Producto.__table__,
                VarianteProducto.__table__,
                Cliente.__table__,
                Venta.__table__,
                DetalleVenta.__table__,
                HistorialEstadoPedido.__table__,
                VarianteAtributo.__table__,
                ProductoComponente.__table__,
                DetalleVentaConsumo.__table__,
            ],
        )
        session = sessionmaker(bind=engine)()
        try:
            store = Tienda(nombre_tienda="Joyeria", slug="joyeria")
            session.add(store)
            session.flush()
            category = Categoria(
                id_tienda=store.id_tienda,
                nombre="Sets",
                slug="sets",
                codigo_sistema="SETS",
            )
            ring = Producto(
                id_tienda=store.id_tienda,
                nombre="Anillo",
                precio_venta=Decimal("120.00"),
                stock_actual=8,
                tipo_producto="SIMPLE",
            )
            necklace = Producto(
                id_tienda=store.id_tienda,
                nombre="Collar",
                precio_venta=Decimal("180.00"),
                stock_actual=5,
                tipo_producto="SIMPLE",
            )
            set_product = Producto(
                id_tienda=store.id_tienda,
                nombre="Set Pandora",
                precio_venta=Decimal("270.00"),
                stock_actual=0,
                tipo_producto="SET",
            )
            session.add_all([category, ring, necklace, set_product])
            session.flush()
            ring_variant = VarianteProducto(
                id_tienda=store.id_tienda,
                id_producto=ring.id_producto,
                sku="ANILLO-T7",
                stock_actual=4,
                activa=True,
                es_predeterminada=True,
            )
            session.add(ring_variant)
            session.flush()
            set_product.id_categoria = category.id_categoria
            set_product.id_categoria_principal = category.id_categoria
            session.add_all([
                ProductoComponente(
                    id_set=set_product.id_producto,
                    id_producto_componente=ring.id_producto,
                    id_variante_componente=ring_variant.id_variante,
                    cantidad=1,
                ),
                ProductoComponente(
                    id_set=set_product.id_producto,
                    id_producto_componente=necklace.id_producto,
                    cantidad=1,
                ),
            ])
            session.commit()

            sale = create_venta(
                session,
                id_tienda=store.id_tienda,
                payload=VentaCreate(
                    estado=EstadoVenta.completada.value,
                    origen="caja",
                    detalles=[
                        DetalleVentaCreate(
                            id_producto=set_product.id_producto,
                            cantidad=2,
                        ),
                    ],
                ),
            )

            session.refresh(ring)
            session.refresh(ring_variant)
            session.refresh(necklace)
            self.assertEqual(ring.stock_actual, 8)
            self.assertEqual(ring_variant.stock_actual, 2)
            self.assertEqual(necklace.stock_actual, 3)
            self.assertEqual(
                sorted(item.cantidad for item in sale.detalles[0].consumos),
                [2, 2],
            )

            update_venta_estado(
                session,
                id_tienda=store.id_tienda,
                id_venta=sale.id_venta,
                nuevo_estado=EstadoVenta.cancelada.value,
            )
            session.refresh(ring)
            session.refresh(ring_variant)
            session.refresh(necklace)
            self.assertEqual(ring.stock_actual, 8)
            self.assertEqual(ring_variant.stock_actual, 4)
            self.assertEqual(necklace.stock_actual, 5)

            set_product.activo = False
            session.commit()
            with self.assertRaisesRegex(ValueError, "no esta disponible"):
                create_venta(
                    session,
                    id_tienda=store.id_tienda,
                    payload=VentaCreate(
                        estado=EstadoVenta.completada.value,
                        origen="caja",
                        detalles=[
                            DetalleVentaCreate(
                                id_producto=set_product.id_producto,
                                cantidad=1,
                            ),
                        ],
                    ),
                )
        finally:
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
