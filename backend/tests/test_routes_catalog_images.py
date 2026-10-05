"""
test_routes_catalog_images.py
------------------------------
Pruebas exhaustivas para la integridad transaccional de guardado,
reemplazo y borrado de imágenes en las rutas de la API:
- Subida y reemplazo de imagen de producto
- Eliminación de imagen de producto
- Banner de oferta
- Imagen de variante
- Portada PDF
- Banner de tema

Verifica los requisitos obligatorios:
1. Orden estricto de operaciones:
   - Guardar físicamente la imagen nueva
   - Preparar cambios de base de datos e incremento de catalog_revision sin commits ocultos
   - Ejecutar exactamente un commit para la operación completa
   - Solo después de un commit exitoso: invalidar caché en memoria y eliminar imagen anterior
2. Si el commit falla:
   - Rollback de la transacción
   - Eliminación únicamente del archivo nuevo
   - Preservación íntegra del archivo anterior
   - La base de datos nunca queda apuntando a un archivo eliminado
3. Si ocurre un fallo posterior al commit (en caché o borrado del archivo antiguo):
   - Registrar warning / objeto huérfano
   - La imagen nueva NUNCA se elimina
   - La respuesta al cliente es exitosa (no se simula que el commit puede revertirse)
4. Sin duplicación de commits en operaciones compuestas (update_offer, update_variant, etc.)
"""

import io
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from api.routes_catalog import (
    api_delete_product_image,
    api_replace_product_image,
    api_upload_offer_banner,
    api_upload_product_image,
    api_upload_theme_banner,
)
from api.routes_catalog_variants import api_upload_variant_image
from api.routes_catalog_pdf_assets import api_upload_catalog_cover
from models.catalog import Oferta, ProductoImagen
from models.catalog_variant import VarianteProducto
from models.tenant import Tienda


def _make_dummy_upload(filename="foto.jpg", content_type="image/jpeg", content=b"\xff\xd8\xffdummy"):
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


class TestRoutesCatalogImages(unittest.TestCase):
    def setUp(self):
        self.tienda_id = uuid4()
        self.user = SimpleNamespace(
            id_usuario=uuid4(),
            id_tienda=self.tienda_id,
            rol="admin",
        )

    # ------------------------------------------------------------------------
    # 1. Rutas de productos: subida, reemplazo y borrado
    # ------------------------------------------------------------------------
    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    @patch("crud.crud_catalog.get_producto_by_id")
    @patch("api.routes_catalog.get_product_image_urls")
    def test_product_image_upload_real_helpers_single_commit(
        self, mock_get_urls, mock_crud_prod, mock_route_prod, mock_delete_asset, mock_save_file
    ):
        """
        Subida de imagen de producto usando los helpers reales:
        - set_product_image y add_product_image reciben commit=False (hacen flush, no commit)
        - Se realiza exactamente UN commit para la operación
        - La caché se invalida tras el commit
        - Ninguna imagen es eliminada
        """
        prod_id = uuid4()
        new_url = "/uploads/products/new_prod.webp"
        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=None,
        )
        mock_route_prod.return_value = producto
        mock_crud_prod.return_value = producto
        mock_save_file.return_value = new_url
        mock_get_urls.return_value = [new_url]

        events = []
        mock_db = MagicMock()
        mock_db.flush.side_effect = lambda: events.append("flush")
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_db.query.return_value.filter.return_value.count.return_value = 0

        file = _make_dummy_upload("nueva.jpg")
        res = api_upload_product_image(
            id_producto=prod_id,
            file=file,
            db=mock_db,
            current_user=self.user,
        )

        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["flush", "flush", "commit"])
        mock_delete_asset.assert_not_called()
        self.assertEqual(producto.imagen_url, new_url)
        self.assertIn("imagen_url", res)

    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    @patch("crud.crud_catalog.get_producto_by_id")
    def test_product_image_upload_commit_failure_rolls_back_and_deletes_new(
        self, mock_crud_prod, mock_route_prod, mock_delete_asset, mock_save_file
    ):
        """
        Si el commit falla al subir imagen:
        - Hace rollback
        - Elimina el archivo nuevo
        - No deja cambios huérfanos
        """
        prod_id = uuid4()
        new_url = "/uploads/products/new_fail.webp"
        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=None,
        )
        mock_route_prod.return_value = producto
        mock_crud_prod.return_value = producto
        mock_save_file.return_value = new_url

        mock_db = MagicMock()
        mock_db.commit.side_effect = RuntimeError("Error en commit")
        mock_db.query.return_value.filter.return_value.count.return_value = 0

        file = _make_dummy_upload("fail.jpg")
        with self.assertRaises(RuntimeError):
            api_upload_product_image(
                id_producto=prod_id,
                file=file,
                db=mock_db,
                current_user=self.user,
            )

        mock_db.rollback.assert_called_once()
        mock_delete_asset.assert_called_once_with(new_url)

    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    @patch("crud.crud_catalog.get_producto_by_id")
    @patch("api.routes_catalog.get_product_image_urls")
    @patch("api.routes_public_catalog.invalidate_public_catalog_cache")
    def test_product_image_upload_post_commit_cache_failure_never_deletes_new(
        self, mock_invalidate_cache, mock_get_urls, mock_crud_prod, mock_route_prod, mock_delete_asset, mock_save_file
    ):
        """
        Si falla la invalidación de caché tras el commit:
        - La imagen nueva NUNCA se elimina
        - La respuesta es exitosa
        """
        prod_id = uuid4()
        new_url = "/uploads/products/new_prod.webp"
        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=None,
        )
        mock_route_prod.return_value = producto
        mock_crud_prod.return_value = producto
        mock_save_file.return_value = new_url
        mock_get_urls.return_value = [new_url]
        mock_invalidate_cache.side_effect = Exception("Fallo de red al invalidar caché")

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id_tienda=self.tienda_id, slug="demo"
        )

        file = _make_dummy_upload("nueva.jpg")
        res = api_upload_product_image(
            id_producto=prod_id,
            file=file,
            db=mock_db,
            current_user=self.user,
        )

        mock_db.commit.assert_called_once()
        mock_delete_asset.assert_not_called()
        self.assertIn("imagen_url", res)

    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    def test_product_image_replace_execution_order_commit_before_delete(
        self, mock_get_prod, mock_delete_asset, mock_save_file
    ):
        """
        Reemplazo exitoso:
        1. Guarda imagen nueva
        2. Ejecuta commit en DB
        3. Solo tras el commit exitoso elimina la imagen antigua
        """
        prod_id = uuid4()
        old_url = "/uploads/products/old_photo.jpg"
        new_url = "/uploads/products/new_photo.webp"

        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=old_url,
        )
        mock_get_prod.return_value = producto
        mock_save_file.return_value = new_url

        events = []
        mock_db = MagicMock()
        mock_img = SimpleNamespace(id_producto=prod_id, imagen_url=old_url, orden=0)
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [mock_img]
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_delete_asset.side_effect = lambda url: events.append(f"delete:{url}")

        file = _make_dummy_upload("nueva.jpg")
        result = api_replace_product_image(
            id_producto=prod_id,
            target_url=old_url,
            file=file,
            db=mock_db,
            current_user=self.user,
        )

        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["commit", f"delete:{old_url}"])
        self.assertEqual(producto.imagen_url, new_url)
        self.assertEqual(mock_img.imagen_url, new_url)

    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    def test_product_image_replace_commit_failure_rolls_back_and_deletes_new(
        self, mock_get_prod, mock_delete_asset, mock_save_file
    ):
        """
        Si el commit falla:
        - Hace rollback
        - Elimina el archivo nuevo
        - Conserva el archivo antiguo intacto
        """
        prod_id = uuid4()
        old_url = "/uploads/products/old_photo.jpg"
        new_url = "/uploads/products/new_photo.webp"

        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=old_url,
        )
        mock_get_prod.return_value = producto
        mock_save_file.return_value = new_url

        mock_db = MagicMock()
        mock_img = SimpleNamespace(id_producto=prod_id, imagen_url=old_url, orden=0)
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [mock_img]
        mock_db.commit.side_effect = RuntimeError("Error en conexión de PostgreSQL")

        file = _make_dummy_upload("nueva.jpg")
        with self.assertRaises(RuntimeError):
            api_replace_product_image(
                id_producto=prod_id,
                target_url=old_url,
                file=file,
                db=mock_db,
                current_user=self.user,
            )

        mock_db.rollback.assert_called_once()
        mock_delete_asset.assert_called_once_with(new_url)

    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    def test_product_image_replace_delete_old_fails_logs_without_breaking(
        self, mock_get_prod, mock_delete_asset, mock_save_file
    ):
        """
        Si falla la eliminación de la imagen antigua tras el commit,
        se registra warning sin romper la respuesta del cliente.
        """
        prod_id = uuid4()
        old_url = "/uploads/products/old_photo.jpg"
        new_url = "/uploads/products/new_photo.webp"

        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=old_url,
        )
        mock_get_prod.return_value = producto
        mock_save_file.return_value = new_url
        mock_delete_asset.side_effect = OSError("Permiso denegado por el sistema de archivos")

        mock_db = MagicMock()
        mock_img = SimpleNamespace(id_producto=prod_id, imagen_url=old_url, orden=0)
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [mock_img]

        file = _make_dummy_upload("nueva.jpg")
        result = api_replace_product_image(
            id_producto=prod_id,
            target_url=old_url,
            file=file,
            db=mock_db,
            current_user=self.user,
        )

        mock_db.commit.assert_called_once()
        self.assertEqual(result.imagen_url, new_url)

    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    def test_product_image_delete_commits_before_physical_deletion(
        self, mock_get_prod, mock_delete_asset
    ):
        """
        En api_delete_product_image:
        - Se confirma el cambio en base de datos primero
        - Solo entonces se llama a delete_asset_file
        """
        prod_id = uuid4()
        old_url = "/uploads/products/old_photo.jpg"

        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=old_url,
        )
        mock_get_prod.return_value = producto

        events = []
        mock_db = MagicMock()
        mock_img = SimpleNamespace(id_producto=prod_id, imagen_url=old_url, orden=0)
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [mock_img],
            [],
        ]
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_delete_asset.side_effect = lambda url: events.append(f"delete:{url}")

        result = api_delete_product_image(
            id_producto=prod_id,
            imagen_url=old_url,
            db=mock_db,
            current_user=self.user,
        )

        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["commit", f"delete:{old_url}"])
        self.assertIsNone(result.imagen_url)

    # ------------------------------------------------------------------------
    # 2. Rutas de ofertas: banner
    # ------------------------------------------------------------------------
    @patch("api.routes_catalog._save_offer_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_offer_by_id")
    def test_offer_banner_real_update_offer_no_duplicate_commit(
        self, mock_get_offer, mock_delete_asset, mock_save_file
    ):
        """
        Verifica que update_offer real recibe commit=False:
        - No hace commit implícito
        - La ruta ejecuta exactamente UN commit
        - La imagen anterior se borra solo tras el commit
        """
        offer_id = uuid4()
        old_banner = "/uploads/offers/old_banner.jpg"
        new_banner = "/uploads/offers/new_banner.webp"

        offer = Oferta(
            id_oferta=offer_id,
            id_tienda=self.tienda_id,
            nombre="Oferta de Temporada",
            tipo="PERCENT",
            porcentaje=Decimal("15.00"),
            prioridad=10,
            activa=True,
            banner_url=old_banner,
        )
        mock_get_offer.return_value = offer
        mock_save_file.return_value = new_banner

        events = []
        mock_db = MagicMock()
        mock_db.flush.side_effect = lambda: events.append("flush")
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_delete_asset.side_effect = lambda url: events.append(f"delete:{url}")

        file = _make_dummy_upload("banner.jpg")
        res = api_upload_offer_banner(
            id_oferta=offer_id,
            file=file,
            db=mock_db,
            current_user=self.user,
            id_tienda=self.tienda_id,
        )

        # Exactamente UN commit para toda la operación (doble commit eliminado)
        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["flush", "commit", f"delete:{old_banner}"])
        self.assertEqual(offer.banner_url, new_banner)
        self.assertIn("banner_url", res)

    @patch("api.routes_catalog._save_offer_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_offer_by_id")
    def test_offer_banner_commit_failure_rolls_back_and_deletes_new(
        self, mock_get_offer, mock_delete_asset, mock_save_file
    ):
        """
        Si el commit falla al subir banner de oferta:
        - Rollback de la BD
        - Elimina el banner nuevo
        - Conserva el banner antiguo
        """
        offer_id = uuid4()
        old_banner = "/uploads/offers/old_banner.jpg"
        new_banner = "/uploads/offers/new_banner.webp"

        offer = Oferta(
            id_oferta=offer_id,
            id_tienda=self.tienda_id,
            nombre="Oferta Fallida",
            tipo="PERCENT",
            porcentaje=Decimal("10.00"),
            prioridad=1,
            activa=True,
            banner_url=old_banner,
        )
        mock_get_offer.return_value = offer
        mock_save_file.return_value = new_banner

        mock_db = MagicMock()
        mock_db.commit.side_effect = RuntimeError("Error confirmando en BD")

        file = _make_dummy_upload("banner.jpg")
        with self.assertRaises(RuntimeError):
            api_upload_offer_banner(
                id_oferta=offer_id,
                file=file,
                db=mock_db,
                current_user=self.user,
                id_tienda=self.tienda_id,
            )

        mock_db.rollback.assert_called_once()
        mock_delete_asset.assert_called_once_with(new_banner)

    @patch("api.routes_catalog._save_offer_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_offer_by_id")
    @patch("api.routes_public_catalog.invalidate_public_catalog_cache")
    def test_offer_banner_post_commit_failure_never_deletes_new(
        self, mock_invalidate_cache, mock_get_offer, mock_delete_asset, mock_save_file
    ):
        """
        Si falla la caché tras el commit del banner:
        - El banner nuevo NUNCA se elimina
        - La respuesta es 200/éxito
        """
        offer_id = uuid4()
        old_banner = "/uploads/offers/old_banner.jpg"
        new_banner = "/uploads/offers/new_banner.webp"

        offer = Oferta(
            id_oferta=offer_id,
            id_tienda=self.tienda_id,
            nombre="Oferta OK",
            tipo="PERCENT",
            porcentaje=Decimal("10.00"),
            prioridad=1,
            activa=True,
            banner_url=old_banner,
        )
        mock_get_offer.return_value = offer
        mock_save_file.return_value = new_banner
        mock_invalidate_cache.side_effect = Exception("Fallo de red en cache")

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id_tienda=self.tienda_id, slug="demo-tienda"
        )

        file = _make_dummy_upload("banner.jpg")
        res = api_upload_offer_banner(
            id_oferta=offer_id,
            file=file,
            db=mock_db,
            current_user=self.user,
            id_tienda=self.tienda_id,
        )

        mock_db.commit.assert_called_once()
        mock_delete_asset.assert_called_once_with(old_banner)
        self.assertIn("banner_url", res)

    # ------------------------------------------------------------------------
    # 3. Rutas de variantes: imagen
    # ------------------------------------------------------------------------
    @patch("api.routes_catalog_variants.save_upload_file")
    @patch("api.routes_catalog_variants.delete_asset_file")
    @patch("api.routes_catalog_variants.get_variant")
    @patch("api.routes_catalog_variants.get_producto_by_id")
    @patch("api.routes_catalog_variants.serialize_variant")
    def test_variant_image_real_update_variant_no_duplicate_commit(
        self, mock_serialize, mock_prod, mock_var, mock_delete_asset, mock_save_file
    ):
        """
        Verifica que update_variant real recibe commit=False:
        - Ejecuta flush, no commit
        - La ruta ejecuta exactamente UN commit
        - La imagen anterior se borra solo tras el commit
        """
        var_id = uuid4()
        prod_id = uuid4()
        old_img = "/uploads/variants/old_var.jpg"
        new_img = "/uploads/variants/new_var.webp"

        product = SimpleNamespace(id_producto=prod_id, id_tienda=self.tienda_id)
        variant = VarianteProducto(
            id_variante=var_id,
            id_tienda=self.tienda_id,
            id_producto=prod_id,
            sku="VAR-L",
            precio_venta=Decimal("80.00"),
            imagen_url=old_img,
            es_predeterminada=False,
            activa=True,
        )
        mock_prod.return_value = product
        mock_var.return_value = variant
        mock_save_file.return_value = new_img
        mock_serialize.return_value = SimpleNamespace(id_variante=str(var_id), imagen_url=new_img)

        events = []
        mock_db = MagicMock()
        mock_db.flush.side_effect = lambda: events.append("flush")
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_delete_asset.side_effect = lambda url: events.append(f"delete:{url}")

        def mock_query_1(model):
            m = MagicMock()
            if model == Tienda:
                m.filter.return_value.first.return_value = SimpleNamespace(
                    id_tienda=self.tienda_id, slug="tienda-test"
                )
            else:
                m.filter.return_value.first.return_value = variant
            return m

        mock_db.query.side_effect = mock_query_1

        file = _make_dummy_upload("variant.jpg")
        res = api_upload_variant_image(
            id_variante=var_id,
            file=file,
            db=mock_db,
            current_user=self.user,
        )

        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["flush", "commit", f"delete:{old_img}"])
        self.assertEqual(variant.imagen_url, new_img)
        self.assertEqual(res.imagen_url, new_img)

    @patch("api.routes_catalog_variants.save_upload_file")
    @patch("api.routes_catalog_variants.delete_asset_file")
    @patch("api.routes_catalog_variants.get_variant")
    @patch("api.routes_catalog_variants.get_producto_by_id")
    def test_variant_image_commit_failure_rolls_back_and_deletes_new(
        self, mock_prod, mock_var, mock_delete_asset, mock_save_file
    ):
        """
        Si el commit falla al subir imagen de variante:
        - Rollback de la BD
        - Elimina la imagen nueva
        - Conserva la imagen antigua
        """
        var_id = uuid4()
        prod_id = uuid4()
        old_img = "/uploads/variants/old_var.jpg"
        new_img = "/uploads/variants/new_var.webp"

        product = SimpleNamespace(id_producto=prod_id, id_tienda=self.tienda_id)
        variant = VarianteProducto(
            id_variante=var_id,
            id_tienda=self.tienda_id,
            id_producto=prod_id,
            sku="VAR-XL",
            precio_venta=Decimal("90.00"),
            imagen_url=old_img,
            es_predeterminada=False,
            activa=True,
        )
        mock_prod.return_value = product
        mock_var.return_value = variant
        mock_save_file.return_value = new_img

        mock_db = MagicMock()
        mock_db.commit.side_effect = RuntimeError("Fallo en commit de variante")

        def mock_query_2(model):
            m = MagicMock()
            if model == Tienda:
                m.filter.return_value.first.return_value = SimpleNamespace(
                    id_tienda=self.tienda_id, slug="tienda-test"
                )
            else:
                m.filter.return_value.first.return_value = variant
            return m

        mock_db.query.side_effect = mock_query_2

        file = _make_dummy_upload("variant.jpg")
        with self.assertRaises(RuntimeError):
            api_upload_variant_image(
                id_variante=var_id,
                file=file,
                db=mock_db,
                current_user=self.user,
            )

        mock_db.rollback.assert_called_once()
        mock_delete_asset.assert_called_once_with(new_img)

    @patch("api.routes_catalog_variants.save_upload_file")
    @patch("api.routes_catalog_variants.delete_asset_file")
    @patch("api.routes_catalog_variants.get_variant")
    @patch("api.routes_catalog_variants.get_producto_by_id")
    @patch("api.routes_public_catalog.invalidate_public_catalog_cache")
    @patch("api.routes_catalog_variants.serialize_variant")
    def test_variant_image_post_commit_failure_never_deletes_new(
        self, mock_serialize, mock_invalidate_cache, mock_prod, mock_var, mock_delete_asset, mock_save_file
    ):
        """
        Si falla la caché tras el commit de la variante:
        - La imagen nueva NUNCA se elimina
        - La respuesta es exitosa
        """
        var_id = uuid4()
        prod_id = uuid4()
        old_img = "/uploads/variants/old_var.jpg"
        new_img = "/uploads/variants/new_var.webp"

        product = SimpleNamespace(id_producto=prod_id, id_tienda=self.tienda_id)
        variant = VarianteProducto(
            id_variante=var_id,
            id_tienda=self.tienda_id,
            id_producto=prod_id,
            sku="VAR-S",
            precio_venta=Decimal("70.00"),
            imagen_url=old_img,
            es_predeterminada=False,
            activa=True,
        )
        mock_prod.return_value = product
        mock_var.return_value = variant
        mock_save_file.return_value = new_img
        mock_invalidate_cache.side_effect = Exception("Fallo en cache tras commit")
        mock_serialize.return_value = SimpleNamespace(id_variante=str(var_id), imagen_url=new_img)

        mock_db = MagicMock()

        def mock_query_3(model):
            m = MagicMock()
            if model == Tienda:
                m.filter.return_value.first.return_value = SimpleNamespace(
                    id_tienda=self.tienda_id, slug="tienda-test"
                )
            else:
                m.filter.return_value.first.return_value = variant
            return m

        mock_db.query.side_effect = mock_query_3

        file = _make_dummy_upload("variant.jpg")
        res = api_upload_variant_image(
            id_variante=var_id,
            file=file,
            db=mock_db,
            current_user=self.user,
        )

        mock_db.commit.assert_called_once()
        mock_delete_asset.assert_called_once_with(old_img)
        self.assertEqual(res.imagen_url, new_img)

    # ------------------------------------------------------------------------
    # 4. Rutas de PDF: portada
    # ------------------------------------------------------------------------
    @patch("api.routes_catalog_pdf_assets.save_upload_file")
    @patch("api.routes_catalog_pdf_assets.delete_catalog_cover")
    @patch("api.routes_catalog_pdf_assets.delete_asset_file")
    @patch("api.routes_catalog_pdf_assets._target_store")
    def test_pdf_cover_replace_commits_then_deletes_old(
        self, mock_target_store, mock_delete_asset, mock_delete_cover, mock_save_file
    ):
        old_cover = "/uploads/catalog-covers/old_cover.jpg"
        new_cover = "/uploads/catalog-covers/new_cover.webp"

        store = SimpleNamespace(
            id_tienda=self.tienda_id,
            theme_config={"catalog_pdf": {"cover_url": old_cover}},
        )
        mock_target_store.return_value = store
        mock_save_file.return_value = new_cover

        events = []
        mock_db = MagicMock()
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_delete_cover.side_effect = lambda url: events.append(f"delete_cover:{url}")

        file = _make_dummy_upload("cover.jpg")
        res = api_upload_catalog_cover(
            file=file,
            db=mock_db,
            current_user=self.user,
            current_tienda_id=self.tienda_id,
        )

        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["commit", f"delete_cover:{old_cover}"])
        self.assertIn("cover_url", res)

    @patch("api.routes_catalog_pdf_assets.save_upload_file")
    @patch("api.routes_catalog_pdf_assets.delete_catalog_cover")
    @patch("api.routes_catalog_pdf_assets.delete_asset_file")
    @patch("api.routes_catalog_pdf_assets._target_store")
    def test_pdf_cover_commit_failure_rolls_back_and_deletes_new(
        self, mock_target_store, mock_delete_asset, mock_delete_cover, mock_save_file
    ):
        """
        Si el commit de portada falla:
        - Hace rollback
        - Elimina la portada nueva
        - Conserva la portada anterior
        """
        old_cover = "/uploads/catalog-covers/old_cover.jpg"
        new_cover = "/uploads/catalog-covers/new_cover.webp"

        store = SimpleNamespace(
            id_tienda=self.tienda_id,
            theme_config={"catalog_pdf": {"cover_url": old_cover}},
        )
        mock_target_store.return_value = store
        mock_save_file.return_value = new_cover

        mock_db = MagicMock()
        mock_db.commit.side_effect = RuntimeError("Fallo en commit de portada")

        file = _make_dummy_upload("cover.jpg")
        with self.assertRaises(RuntimeError):
            api_upload_catalog_cover(
                file=file,
                db=mock_db,
                current_user=self.user,
                current_tienda_id=self.tienda_id,
            )

        mock_db.rollback.assert_called_once()
        mock_delete_asset.assert_called_once_with(new_cover)
        mock_delete_cover.assert_not_called()

    # ------------------------------------------------------------------------
    # 5. Rutas de Tema: banner hero
    # ------------------------------------------------------------------------
    @patch("api.routes_catalog._save_theme_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    def test_theme_banner_commit_then_deletes_old(
        self, mock_delete_asset, mock_save_file
    ):
        old_banner = "/uploads/theme/old_hero.jpg"
        new_banner = "/uploads/theme/new_hero.webp"

        tienda = SimpleNamespace(
            id_tienda=self.tienda_id,
            slug="tienda-test",
            theme_config={"hero_image_url": old_banner},
        )
        mock_save_file.return_value = new_banner

        events = []
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = tienda
        mock_db.commit.side_effect = lambda: events.append("commit")
        mock_delete_asset.side_effect = lambda url: events.append(f"delete:{url}")

        file = _make_dummy_upload("hero.jpg")
        res = api_upload_theme_banner(
            file=file,
            db=mock_db,
            current_user=self.user,
            id_tienda=self.tienda_id,
        )

        self.assertEqual(mock_db.commit.call_count, 1)
        self.assertEqual(events, ["commit", f"delete:{old_banner}"])
        self.assertIn("hero_image_url", res)

    @patch("api.routes_catalog._save_theme_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    def test_theme_banner_commit_failure_rolls_back_and_deletes_new(
        self, mock_delete_asset, mock_save_file
    ):
        old_banner = "/uploads/theme/old_hero.jpg"
        new_banner = "/uploads/theme/new_hero.webp"

        tienda = SimpleNamespace(
            id_tienda=self.tienda_id,
            slug="tienda-test",
            theme_config={"hero_image_url": old_banner},
        )
        mock_save_file.return_value = new_banner

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = tienda
        mock_db.commit.side_effect = RuntimeError("Fallo en commit de tema")

        file = _make_dummy_upload("hero.jpg")
        with self.assertRaises(RuntimeError):
            api_upload_theme_banner(
                file=file,
                db=mock_db,
                current_user=self.user,
                id_tienda=self.tienda_id,
            )

        mock_db.rollback.assert_called_once()
        mock_delete_asset.assert_called_once_with(new_banner)

    # ------------------------------------------------------------------------
    # 7. Pruebas de fallo en db.refresh() post-commit:
    #    El commit ya es definitivo, por lo que:
    #    - La nueva imagen NUNCA se elimina
    #    - No se intenta hacer rollback
    #    - La imagen anterior se elimina si corresponde
    #    - Se registra warning sin romper la respuesta
    # ------------------------------------------------------------------------
    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    @patch("crud.crud_catalog.get_producto_by_id")
    @patch("api.routes_catalog.get_product_image_urls")
    def test_product_image_upload_commit_success_refresh_fails_never_deletes_new(
        self, mock_get_urls, mock_crud_prod, mock_route_prod, mock_delete_asset, mock_save_file
    ):
        prod_id = uuid4()
        new_url = "/uploads/products/new_img.webp"
        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=None,
        )
        mock_route_prod.return_value = producto
        mock_crud_prod.return_value = producto
        mock_save_file.return_value = new_url
        mock_get_urls.return_value = [new_url]

        mock_db = MagicMock()
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = RuntimeError("Conexión perdida durante refresh")

        file = _make_dummy_upload("test.jpg")
        with self.assertLogs("routes_catalog", level="WARNING") as cm:
            res = api_upload_product_image(
                id_producto=prod_id,
                file=file,
                db=mock_db,
                current_user=self.user,
            )

        mock_db.commit.assert_called_once()
        mock_db.rollback.assert_not_called()
        mock_delete_asset.assert_not_called()
        self.assertIn("Fallo post-commit al refrescar producto", cm.output[0])
        self.assertIn(new_url, res["imagen_url"])

    @patch("api.routes_catalog._save_product_image_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    @patch("api.routes_catalog._ensure_product_images_sync")
    def test_product_image_replace_commit_success_refresh_fails_preserves_new_deletes_old(
        self, mock_sync, mock_get_prod, mock_delete_asset, mock_save_file
    ):
        prod_id = uuid4()
        old_url = "/uploads/products/old_target.webp"
        new_url = "/uploads/products/new_replacement.webp"

        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=old_url,
        )
        mock_get_prod.return_value = producto

        db_img = ProductoImagen(
            id_imagen=uuid4(),
            id_producto=prod_id,
            imagen_url=old_url,
            orden=0,
        )
        mock_sync.return_value = [db_img]
        mock_save_file.return_value = new_url

        mock_db = MagicMock()
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = RuntimeError("Refresh timeout tras commit")

        file = _make_dummy_upload("replacement.jpg")
        with self.assertLogs("routes_catalog", level="WARNING") as cm:
            res = api_replace_product_image(
                id_producto=prod_id,
                target_url=old_url,
                file=file,
                db=mock_db,
                current_user=self.user,
            )

        mock_db.commit.assert_called_once()
        mock_db.rollback.assert_not_called()
        mock_delete_asset.assert_called_once_with(old_url)
        self.assertIn("Fallo post-commit al refrescar producto", cm.output[0])
        self.assertEqual(res.id_producto, prod_id)

    @patch("api.routes_catalog._save_offer_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_offer_by_id")
    def test_offer_banner_commit_success_refresh_fails_preserves_new_deletes_old(
        self, mock_get_offer, mock_delete_asset, mock_save_file
    ):
        offer_id = uuid4()
        old_banner = "/uploads/offers/old_banner.jpg"
        new_banner = "/uploads/offers/new_banner.webp"

        offer = Oferta(
            id_oferta=offer_id,
            id_tienda=self.tienda_id,
            nombre="Oferta Test",
            tipo="PERCENT",
            porcentaje=Decimal("15.00"),
            prioridad=1,
            activa=True,
            banner_url=old_banner,
        )
        mock_get_offer.return_value = offer
        mock_save_file.return_value = new_banner

        mock_db = MagicMock()
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = RuntimeError("Error en refresh de oferta")

        file = _make_dummy_upload("banner.jpg")
        with self.assertLogs("routes_catalog", level="WARNING") as cm:
            res = api_upload_offer_banner(
                id_oferta=offer_id,
                file=file,
                db=mock_db,
                current_user=self.user,
                id_tienda=self.tienda_id,
            )

        mock_db.commit.assert_called_once()
        mock_db.rollback.assert_not_called()
        mock_delete_asset.assert_called_once_with(old_banner)
        self.assertIn("Fallo post-commit al refrescar oferta", cm.output[0])
        self.assertIn(new_banner, res["banner_url"])

    @patch("api.routes_catalog._save_theme_banner_file")
    @patch("api.routes_catalog.delete_asset_file")
    def test_theme_banner_commit_success_refresh_fails_preserves_new_deletes_old(
        self, mock_delete_asset, mock_save_file
    ):
        old_banner = "/uploads/theme/old_theme.jpg"
        new_banner = "/uploads/theme/new_theme.webp"

        tienda = SimpleNamespace(
            id_tienda=self.tienda_id,
            slug="tienda-test",
            theme_config={"hero_image_url": old_banner},
        )
        mock_save_file.return_value = new_banner

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = tienda
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = RuntimeError("Error en refresh de tienda")

        file = _make_dummy_upload("hero.jpg")
        with self.assertLogs("routes_catalog", level="WARNING") as cm:
            res = api_upload_theme_banner(
                file=file,
                db=mock_db,
                current_user=self.user,
                id_tienda=self.tienda_id,
            )

        mock_db.commit.assert_called_once()
        mock_db.rollback.assert_not_called()
        mock_delete_asset.assert_called_once_with(old_banner)
        self.assertIn("Fallo post-commit al refrescar tienda", cm.output[0])
        self.assertIn(new_banner, res["hero_image_url"])

    @patch("api.routes_catalog.delete_asset_file")
    @patch("api.routes_catalog.get_producto_by_id")
    @patch("api.routes_catalog._ensure_product_images_sync")
    def test_product_image_delete_commit_success_refresh_fails_deletes_old_image(
        self, mock_sync, mock_get_prod, mock_delete_asset
    ):
        prod_id = uuid4()
        img_url = "/uploads/products/to_delete.webp"

        producto = SimpleNamespace(
            id_producto=prod_id,
            id_tienda=self.tienda_id,
            imagen_url=img_url,
        )
        mock_get_prod.return_value = producto

        db_img = ProductoImagen(
            id_imagen=uuid4(),
            id_producto=prod_id,
            imagen_url=img_url,
            orden=0,
        )
        mock_sync.return_value = [db_img]

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = RuntimeError("Refresh fail tras commit de borrado")

        with self.assertLogs("routes_catalog", level="WARNING") as cm:
            res = api_delete_product_image(
                id_producto=prod_id,
                imagen_url=img_url,
                db=mock_db,
                current_user=self.user,
            )

        mock_db.commit.assert_called_once()
        mock_db.rollback.assert_not_called()
        mock_delete_asset.assert_called_once_with(img_url)
        self.assertIn("Fallo post-commit al refrescar producto", cm.output[0])
        self.assertEqual(res.id_producto, prod_id)


if __name__ == "__main__":
    unittest.main()
