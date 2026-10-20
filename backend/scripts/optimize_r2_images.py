#!/usr/bin/env python3
"""
optimize_r2_images.py
---------------------
Script seguro e idempotente para optimizar imágenes almacenadas en Cloudflare R2
y actualizar sus referencias en la base de datos (Neon PostgreSQL).

Comportamiento por defecto:
  - DRY-RUN: Muestra qué imágenes se optimizarían, el peso actual y el peso proyectado en WebP.
  - Para aplicar los cambios reales en R2 y la base de datos se debe pasar: --apply
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path
from urllib.parse import urlparse

# Agregar backend/ al sys.path
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Cargar variables de entorno desde backend/.env si existe
_env_file = _BACKEND_DIR / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        pass

from PIL import Image
import boto3
from botocore.config import Config
from sqlalchemy import text

from core.config import settings
from core.database import SessionLocal


def parse_args():
    parser = argparse.ArgumentParser(
        description="Optimiza imágenes PNG/JPG en Cloudflare R2 a WebP y actualiza Neon DB."
    )
    parser.add_argument(
        "--store-slug",
        type=str,
        default="yr-accesorios",
        help="Slug de la tienda a optimizar (por defecto: yr-accesorios)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Aplica los cambios reales en R2 y Base de Datos (por defecto es DRY-RUN)",
    )
    parser.add_argument(
        "--max-width",
        type=int,
        default=1080,
        help="Ancho máximo en píxeles (default: 1080)",
    )
    parser.add_argument(
        "--max-height",
        type=int,
        default=1080,
        help="Alto máximo en píxeles (default: 1080)",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=82,
        help="Calidad WebP (1-100, default: 82)",
    )
    parser.add_argument(
        "--delete-original",
        action="store_true",
        default=False,
        help="Elimina el archivo PNG/JPG original de R2 tras confirmar la migración a WebP",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Límite de imágenes a procesar (para pruebas)",
    )
    return parser.parse_args()


def extract_r2_key(url: str, public_base: str) -> str | None:
    if not url:
        return None
    url = url.strip()
    parsed = urlparse(url)
    base_parsed = urlparse(public_base)
    if parsed.netloc and base_parsed.netloc and parsed.netloc == base_parsed.netloc:
        return parsed.path.lstrip("/")
    if "r2.dev" in parsed.netloc or "cloudflarestorage.com" in parsed.netloc:
        return parsed.path.lstrip("/")
    return None


def convert_to_webp(raw_bytes: bytes, max_width: int, max_height: int, quality: int) -> bytes:
    img = Image.open(io.BytesIO(raw_bytes))
    
    # Preservar transparencia si es RGBA, si no convertir a RGB
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")
    
    # Redimensionar si supera límites manteniendo proporción
    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=4)
    return buf.getvalue()


def main():
    args = parse_args()
    is_dry_run = not args.apply

    print("=" * 60)
    print(" OPTIMIZADOR DE IMÁGENES CLOUDFLARE R2 -> WEBP")
    print("=" * 60)
    print(f" Modo:          {'[DRY-RUN (Simulación)]' if is_dry_run else '[APPLY (Cambios reales)]'}")
    print(f" Tienda:        {args.store_slug}")
    print(f" Max dimensión: {args.max_width}x{args.max_height} px")
    print(f" Calidad WebP:  {args.quality}")
    print(f" Borrar orig.:  {args.delete_original}")
    print("=" * 60)

    # Inicializar cliente R2
    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL.rstrip("/"),
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = settings.R2_BUCKET_NAME
    public_base = settings.R2_PUBLIC_BASE_URL.rstrip("/")

    db = SessionLocal()
    try:
        # Obtener tienda
        tienda = db.execute(
            text("SELECT id_tienda, nombre_tienda, slug FROM tiendas WHERE slug = :slug"),
            {"slug": args.store_slug},
        ).fetchone()

        if not tienda:
            print(f"ERROR: Tienda con slug '{args.store_slug}' no encontrada.")
            sys.exit(1)

        tienda_id = tienda[0]
        print(f"Tienda encontrada: {tienda[1]} ({tienda_id})\n")

        # 1. Obtener productos con imágenes no-webp
        prods = db.execute(
            text("""
                SELECT id_producto, nombre, imagen_url
                FROM productos
                WHERE id_tienda = :tid
                  AND imagen_url IS NOT NULL
                  AND imagen_url NOT LIKE '%.webp'
            """),
            {"tid": tienda_id},
        ).fetchall()

        # 2. Obtener galería de imágenes no-webp
        gallery_imgs = db.execute(
            text("""
                SELECT pi.id_imagen, pi.id_producto, pi.imagen_url
                FROM producto_imagenes pi
                JOIN productos p ON pi.id_producto = p.id_producto
                WHERE p.id_tienda = :tid
                  AND pi.imagen_url IS NOT NULL
                  AND pi.imagen_url NOT LIKE '%.webp'
            """),
            {"tid": tienda_id},
        ).fetchall()

        if args.limit is not None:
            prods = prods[:args.limit]
            remaining_limit = max(0, args.limit - len(prods))
            gallery_imgs = gallery_imgs[:remaining_limit]

        total_targets = len(prods) + len(gallery_imgs)
        print(f"Imágenes principales de producto a optimizar: {len(prods)}", flush=True)
        print(f"Imágenes de galería a optimizar:              {len(gallery_imgs)}", flush=True)
        print(f"Total imágenes a procesar:                   {total_targets}\n", flush=True)

        if total_targets == 0:
            print("No se encontraron imágenes pendientes de optimización. ¡Todo está en WebP!")
            return

        total_bytes_before = 0
        total_bytes_after = 0
        processed_count = 0
        errors = 0

        # Procesar imágenes principales
        for prod_id, prod_name, img_url in prods:
            key = extract_r2_key(img_url, public_base)
            if not key:
                print(f"[SKIP] No es clave R2 válida: {img_url}")
                continue

            try:
                # Descargar objeto
                obj = s3_client.get_object(Bucket=bucket, Key=key)
                raw_data = obj["Body"].read()
                orig_size = len(raw_data)
                total_bytes_before += orig_size

                # Optimizar a WebP
                webp_data = convert_to_webp(raw_data, args.max_width, args.max_height, args.quality)
                webp_size = len(webp_data)
                total_bytes_after += webp_size

                # Nueva clave WebP
                new_key = Path(key).with_suffix(".webp").as_posix()
                new_url = f"{public_base}/{new_key}"
                reduction = ((orig_size - webp_size) / orig_size) * 100

                print(
                    f"[{'APPLY' if not is_dry_run else 'DRY'}] Prod: {prod_name[:25]:25} | "
                    f"{orig_size/1024:7.1f}KB -> {webp_size/1024:5.1f}KB (-{reduction:4.1f}%)",
                    flush=True,
                )

                if not is_dry_run:
                    # Subir a R2
                    s3_client.put_object(
                        Bucket=bucket,
                        Key=new_key,
                        Body=webp_data,
                        ContentType="image/webp",
                        CacheControl="public, max-age=31536000, immutable",
                    )
                    # Actualizar DB
                    db.execute(
                        text("UPDATE productos SET imagen_url = :new_url WHERE id_producto = :pid"),
                        {"new_url": new_url, "pid": prod_id},
                    )
                    if args.delete_original and new_key != key:
                        s3_client.delete_object(Bucket=bucket, Key=key)

                processed_count += 1
            except Exception as e:
                errors += 1
                print(f"[ERROR] En producto {prod_id} ({key}): {e}")

        # Procesar imágenes de galería
        for img_id, prod_id, img_url in gallery_imgs:
            key = extract_r2_key(img_url, public_base)
            if not key:
                continue

            try:
                obj = s3_client.get_object(Bucket=bucket, Key=key)
                raw_data = obj["Body"].read()
                orig_size = len(raw_data)
                total_bytes_before += orig_size

                webp_data = convert_to_webp(raw_data, args.max_width, args.max_height, args.quality)
                webp_size = len(webp_data)
                total_bytes_after += webp_size

                new_key = Path(key).with_suffix(".webp").as_posix()
                new_url = f"{public_base}/{new_key}"
                reduction = ((orig_size - webp_size) / orig_size) * 100

                print(
                    f"[{'APPLY' if not is_dry_run else 'DRY'}] Galería {img_id}: "
                    f"{orig_size/1024:7.1f}KB -> {webp_size/1024:5.1f}KB (-{reduction:4.1f}%)"
                )

                if not is_dry_run:
                    s3_client.put_object(
                        Bucket=bucket,
                        Key=new_key,
                        Body=webp_data,
                        ContentType="image/webp",
                        CacheControl="public, max-age=31536000, immutable",
                    )
                    db.execute(
                        text("UPDATE producto_imagenes SET imagen_url = :new_url WHERE id_imagen = :iid"),
                        {"new_url": new_url, "iid": img_id},
                    )
                    if args.delete_original and new_key != key:
                        s3_client.delete_object(Bucket=bucket, Key=key)

                processed_count += 1
            except Exception as e:
                errors += 1
                print(f"[ERROR] En imagen de galería {img_id} ({key}): {e}")

        if not is_dry_run:
            # Incrementar versión de catálogo para invalidar caché en memoria del backend
            db.execute(
                text("UPDATE tiendas SET catalog_revision = catalog_revision + 1 WHERE id_tienda = :tid"),
                {"tid": tienda_id},
            )
            db.commit()
            print("\n[OK] ¡Transacción confirmada en base de datos y revisión de catálogo actualizada!")
        else:
            print("\n[INFO] Simulación completada (ningún archivo ni registro fue modificado).")

        # Resumen final
        mb_before = total_bytes_before / (1024 * 1024)
        mb_after = total_bytes_after / (1024 * 1024)
        total_saving_pct = ((total_bytes_before - total_bytes_after) / total_bytes_before * 100) if total_bytes_before else 0

        print("\n" + "=" * 60)
        print(" RESUMEN DE OPTIMIZACIÓN")
        print("=" * 60)
        print(f" Imágenes procesadas: {processed_count}")
        print(f" Errores:             {errors}")
        print(f" Peso original:       {mb_before:.2f} MB")
        print(f" Peso en WebP:        {mb_after:.2f} MB")
        print(f" Ahorro de ancho banda: -{mb_before - mb_after:.2f} MB ({total_saving_pct:.1f}% menos)")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"ERROR CRÍTICO: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
