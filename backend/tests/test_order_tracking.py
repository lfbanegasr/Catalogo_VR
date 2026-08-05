import unittest
from decimal import Decimal
from uuid import uuid4

from pydantic import ValidationError

from crud.crud_sales import ACTIVE_ORDER_STATES, ORDER_STATE_RANK, _normalize_phone
from models.sales import EstadoVenta
from schemas.sales_schema import (
    DetalleVentaCreate,
    EntregaPedidoIn,
    SeguimientoPedidoOut,
    VentaCreate,
    VentaEstadoUpdate,
)


class TestOrderTracking(unittest.TestCase):
    def test_delivery_requires_address_and_city(self):
        with self.assertRaises(ValidationError):
            EntregaPedidoIn(metodo="delivery", linea1="", ciudad="")

    def test_pickup_remains_backward_compatible(self):
        payload = VentaCreate(
            detalles=[DetalleVentaCreate(id_producto=uuid4(), cantidad=1)],
        )
        self.assertEqual(payload.entrega.metodo, "retiro")
        self.assertIsNone(payload.cliente_nuevo)

    def test_phone_is_normalized_for_customer_deduplication(self):
        self.assertEqual(_normalize_phone("+591 700-12-345"), "59170012345")
        self.assertIsNone(_normalize_phone(""))

    def test_operational_states_are_active_inventory_states(self):
        for state in (
            EstadoVenta.confirmada,
            EstadoVenta.preparando,
            EstadoVenta.lista,
            EstadoVenta.enviada,
        ):
            self.assertIn(state.value, ACTIVE_ORDER_STATES)
        self.assertNotIn(EstadoVenta.cancelada.value, ACTIVE_ORDER_STATES)
        self.assertLess(
            ORDER_STATE_RANK[EstadoVenta.preparando.value],
            ORDER_STATE_RANK[EstadoVenta.completada.value],
        )

    def test_status_update_accepts_customer_note(self):
        payload = VentaEstadoUpdate(
            estado="preparando",
            nota="Tu pedido ya esta siendo preparado.",
        )
        self.assertEqual(payload.nota, "Tu pedido ya esta siendo preparado.")

    def test_public_tracking_contract_excludes_private_address(self):
        payload = SeguimientoPedidoOut(
            codigo_seguimiento="ABC123DEF456",
            estado="pendiente",
            fecha_pedido="2026-08-03T10:00:00",
            fecha_actualizacion="2026-08-03T10:00:00",
            metodo_entrega="delivery",
            total_venta=Decimal("25.00"),
        )
        serialized = payload.model_dump()
        self.assertNotIn("direccion_snapshot", serialized)
        self.assertNotIn("cliente", serialized)


if __name__ == "__main__":
    unittest.main()
