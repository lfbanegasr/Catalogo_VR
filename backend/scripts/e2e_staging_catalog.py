from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def request_json(base_url: str, path: str, method: str = "GET", payload: dict | None = None) -> Any:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
        data=data,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} devolvi? HTTP {exc.code}: {body}") from exc


def find_available_item(catalog: dict) -> tuple[dict, dict | None, int]:
    for product in catalog.get("productos", []):
        for variant in product.get("variantes", []):
            if int(variant.get("stock") or 0) > 0:
                return product, variant, int(variant["stock"])
        if not product.get("tiene_variantes") and int(product.get("stock") or 0) > 0:
            return product, None, int(product["stock"])
    raise RuntimeError("No hay un producto con stock para el smoke E2E")


def current_stock(catalog: dict, product_id: str, variant_id: str | None) -> int:
    product = next(item for item in catalog["productos"] if str(item["id"]) == product_id)
    if variant_id:
        variant = next(item for item in product["variantes"] if str(item["id_variante"]) == variant_id)
        return int(variant["stock"])
    return int(product["stock"])


def run(base_url: str, slug: str, exercise_checkout: bool) -> None:
    health = request_json(base_url, "/health")
    ready = request_json(base_url, "/ready")
    if health.get("status") != "ok" or ready.get("status") != "ready":
        raise RuntimeError(f"Health/ready inv?lido: {health} / {ready}")

    path = f"/api/public/catalog/{slug}"
    catalog = request_json(base_url, path)
    product, variant, stock_before = find_available_item(catalog)
    print(f"Lectura OK: {catalog['tienda']['nombre']} / {len(catalog['productos'])} productos")
    if not exercise_checkout:
        print("Smoke de solo lectura completado")
        return

    product_id = str(product["id"])
    variant_id = str(variant["id_variante"]) if variant else None
    detail = {"id_producto": product_id, "cantidad": 1}
    if variant_id:
        detail["id_variante"] = variant_id
    order = request_json(
        base_url,
        f"{path}/checkout",
        method="POST",
        payload={
            "cliente_nuevo": {
                "nombre_completo": "Smoke Test Staging",
                "telefono": "70000000",
                "email": "smoke-staging@example.invalid",
            },
            "entrega": {"metodo": "retiro"},
            "metodo_pago": "prueba_staging",
            "notas_cliente": "Pedido autom?tico E2E; no preparar.",
            "detalles": [detail],
        },
    )
    tracking_code = order.get("codigo_seguimiento")
    if not tracking_code:
        raise RuntimeError("El checkout no devolvi? c?digo de seguimiento")

    refreshed = request_json(base_url, path)
    stock_after = current_stock(refreshed, product_id, variant_id)
    if stock_after != stock_before - 1:
        raise RuntimeError(f"El stock no disminuy? correctamente: {stock_before} -> {stock_after}")

    tracked = request_json(base_url, f"{path}/orders/{tracking_code}")
    if tracked.get("codigo_seguimiento") != tracking_code:
        raise RuntimeError("El seguimiento no devolvi? el pedido creado")
    print(f"Checkout/inventario/seguimiento OK: {tracking_code}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke E2E seguro para staging")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--slug", default="demo-accesorios")
    parser.add_argument("--exercise-checkout", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()
    if args.exercise_checkout and args.confirm != "STAGING":
        parser.error("--exercise-checkout requiere --confirm STAGING")
    run(args.base_url, args.slug, args.exercise_checkout)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"E2E FALL?: {exc}", file=sys.stderr)
        raise SystemExit(1)
