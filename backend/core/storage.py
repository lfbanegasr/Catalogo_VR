"""
storage.py
----------
Módulo de almacenamiento de archivos para Catalogo VR.

Funcionalidades:
  - Validación real del contenido (magic bytes) a través de image_pipeline.
  - Conversión automática a WebP optimizado (configurable).
  - Protección contra path traversal y archivos corruptos.
  - Soporte para almacenamiento local y Cloudflare R2.
  - Eliminación segura unificada (delete_asset_file) para local y R2.
  - Cierre garantizado de recursos (UploadFile).
  - Cache-Control de larga duración para nombres inmutables.
  - Construcción de URLs públicas absolutas o relativas.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, UploadFile, status

from core.config import settings

logger = logging.getLogger("storage")

# ---------------------------------------------------------------------------
# Tipos MIME declarados aceptados (aún se valida el contenido real)
# ---------------------------------------------------------------------------
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

# Constantes de compatibilidad con código existente
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def is_external_or_r2_url(path_or_url: str | None) -> bool:
    """Detecta si una ruta es una URL externa o de R2."""
    if not path_or_url:
        return False
    path_str = str(path_or_url).strip()
    return path_str.startswith("http://") or path_str.startswith("https://")


def save_upload_file(file: UploadFile, subfolder: str, entity_id: UUID) -> str:
    """
    Valida, optimiza y guarda un UploadFile en el subfolder indicado.

    Proceso:
      1. Rechaza tipos MIME declarados no permitidos.
      2. Lee con límite max_bytes + 1 y valida por magic bytes.
      3. Si IMAGE_OPTIMIZE_ENABLED está activo, convierte a WebP.
      4. Genera nombre inmutable y único ({entity_id}_{timestamp}.webp).
      5. Guarda en almacenamiento local o R2 según STORAGE_BACKEND.
      6. Cierra el archivo UploadFile garantizado en bloque finally.

    Retorna la ruta relativa web (p.ej. /uploads/products/xyz.webp)
    o la URL absoluta de R2.
    """
    try:
        # 1. Validación rápida del MIME declarado
        content_type = (file.content_type or "").lower().strip()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato no permitido. Usa JPG, PNG o WebP.",
            )

        # 2. Leer con lectura acotada y validar por magic bytes
        from core.image_pipeline import read_and_validate_raw, process_image

        raw = read_and_validate_raw(
            file,
            max_bytes=settings.IMAGE_MAX_INPUT_BYTES,
        )

        # 3. Optimizar y convertir a WebP (o conservar raw si está desactivado)
        if settings.IMAGE_OPTIMIZE_ENABLED:
            processed = process_image(
                raw,
                max_width=settings.IMAGE_MAX_WIDTH,
                max_height=settings.IMAGE_MAX_HEIGHT,
                max_pixels=settings.IMAGE_MAX_PIXELS,
                quality=settings.IMAGE_WEBP_QUALITY,
            )
            ext = ".webp"
            output_content_type = "image/webp"
        else:
            processed = raw
            from core.image_pipeline import _detect_format_from_bytes
            fmt = _detect_format_from_bytes(raw)
            ext_map = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
            ext = ext_map.get(fmt or "", ".jpg")
            output_content_type = content_type

        # 4. Nombre único e inmutable
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        filename = f"{entity_id}_{timestamp}{ext}"

        # 5. Delegar al backend correspondiente
        if settings.STORAGE_BACKEND.strip().lower() == "r2":
            return _save_bytes_to_r2(processed, subfolder, filename, output_content_type)

        return _save_bytes_local(processed, subfolder, filename)
    finally:
        try:
            file.file.close()
        except Exception:
            pass


def _save_bytes_local(data: bytes, subfolder: str, filename: str) -> str:
    """Guarda bytes en el sistema de archivos local. Retorna ruta web relativa."""
    uploads_base_path = settings.UPLOADS_PATH.resolve()
    target_dir = (uploads_base_path / subfolder).resolve()

    # Verificar path traversal con Path.is_relative_to()
    try:
        if not target_dir.is_relative_to(uploads_base_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Intento de path traversal detectado.",
            )
    except (ValueError, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Intento de path traversal detectado.",
        ) from exc

    target_dir.mkdir(parents=True, exist_ok=True)
    destination = (target_dir / filename).resolve()

    try:
        if not destination.is_relative_to(uploads_base_path) or destination == uploads_base_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Intento de path traversal detectado.",
            )
    except (ValueError, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Intento de path traversal detectado.",
        ) from exc

    # Escribir en un archivo temporal primero y renombrar atómicamente
    tmp_destination = destination.with_suffix(destination.suffix + ".tmp")
    try:
        tmp_destination.write_bytes(data)
        tmp_destination.replace(destination)
    except Exception as exc:
        tmp_destination.unlink(missing_ok=True)
        logger.exception("Error al escribir imagen en disco")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al guardar la imagen.",
        ) from exc

    if not destination.exists() or destination.stat().st_size == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al guardar la imagen.",
        )

    public_path = f"/uploads/{subfolder}/{filename}"
    saved_size = destination.stat().st_size

    logger.info(
        "[storage] saved=%s size=%d public_path=%s",
        destination.as_posix(),
        saved_size,
        public_path,
    )
    print(f"[storage] saved={destination.as_posix()}", flush=True)
    print(f"[storage] size={saved_size}", flush=True)
    print(f"[storage] public_path={public_path}", flush=True)

    return public_path


def _save_bytes_to_r2(
    data: bytes,
    subfolder: str,
    filename: str,
    content_type: str,
) -> str:
    """Sube bytes a Cloudflare R2. Retorna la URL pública."""
    object_key = f"{subfolder.strip('/')}/{filename}"
    try:
        import io as _io
        import boto3
        from botocore.config import Config

        client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL.rstrip("/"),
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
        client.upload_fileobj(
            _io.BytesIO(data),
            settings.R2_BUCKET_NAME,
            object_key,
            ExtraArgs={
                "ContentType": content_type,
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
    except Exception as exc:
        logger.exception("No se pudo guardar la imagen en R2")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo guardar la imagen en el almacenamiento externo.",
        ) from exc

    public_url = f"{settings.R2_PUBLIC_BASE_URL.rstrip('/')}/{object_key}"
    logger.info("[storage] backend=r2 key=%s size=%d", object_key, len(data))
    print(f"[storage] backend=r2 key={object_key}", flush=True)
    print(f"[storage] size={len(data)}", flush=True)
    return public_url


def is_valid_r2_asset_url(url: str) -> tuple[bool, str]:
    """
    Verifica si una URL pertenece exactamente al bucket/dominio configurado en R2_PUBLIC_BASE_URL.
    Retorna (es_valido, object_key).
    Rechaza dominios engañosos, prefijos no coincidentes y URLs externas.
    """
    if settings.STORAGE_BACKEND.strip().lower() != "r2":
        return False, ""

    public_base = (settings.R2_PUBLIC_BASE_URL or "").strip()
    if not public_base:
        return False, ""

    from urllib.parse import urlparse
    parsed_base = urlparse(public_base)
    parsed_target = urlparse(url)

    if parsed_base.scheme not in ("http", "https") or parsed_target.scheme not in ("http", "https"):
        return False, ""

    if parsed_base.scheme.lower() != parsed_target.scheme.lower():
        return False, ""
    if parsed_base.netloc.lower() != parsed_target.netloc.lower():
        return False, ""

    base_path = parsed_base.path.rstrip("/")
    target_path = parsed_target.path

    if base_path:
        if not (target_path == base_path or target_path.startswith(base_path + "/")):
            return False, ""
        object_key = target_path[len(base_path):].lstrip("/")
    else:
        object_key = target_path.lstrip("/")

    if not object_key or ".." in object_key:
        return False, ""

    return True, object_key


def delete_asset_file(path_or_url: str | None) -> bool:
    """
    Elimina un archivo de imagen de forma compatible con almacenamiento local y R2.
    Detecta automáticamente si la ruta es local o una URL remota de R2.
    Nunca trata una URL remota de R2 como un archivo en disco local.
    Si STORAGE_BACKEND no es 'r2', ninguna URL externa provocará delete_object.
    Retorna True si fue eliminado o False si no existía, fue ignorado o falló.
    """
    if not path_or_url:
        return False

    path_str = str(path_or_url).strip()
    if not path_str:
        return False

    if path_str.startswith("http://") or path_str.startswith("https://"):
        is_r2, object_key = is_valid_r2_asset_url(path_str)
        if is_r2 and object_key:
            return _delete_from_r2(object_key)
        logger.info("[storage] URL externa o no perteneciente a R2 ignorada para borrado: %s", path_str)
        return False

    return _delete_from_local(path_str)


def _delete_from_local(rel_path: str) -> bool:
    """Elimina un archivo local verificando path traversal con Path.is_relative_to()."""
    cleaned = rel_path.lstrip("/")
    if cleaned.startswith("uploads/"):
        cleaned = cleaned[len("uploads/"):]

    uploads_base = settings.UPLOADS_PATH.resolve()
    try:
        target = (uploads_base / cleaned).resolve()
        if not target.is_relative_to(uploads_base) or target == uploads_base:
            logger.warning("Intento de path traversal al eliminar archivo: %s", rel_path)
            return False
    except (ValueError, Exception):
        logger.warning("Intento de path traversal al eliminar archivo: %s", rel_path)
        return False

    try:
        if target.is_file():
            target.unlink()
            logger.info("[storage] deleted local file: %s", target)
            return True
        return False
    except OSError as exc:
        logger.warning("Error al eliminar archivo local %s: %s", target, exc)
        return False


def _delete_from_r2(object_key: str) -> bool:
    """Elimina el objeto de Cloudflare R2 vía cliente S3 usando la clave de objeto validada."""
    if not object_key or ".." in object_key:
        return False

    try:
        import boto3
        from botocore.config import Config

        client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL.rstrip("/"),
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
        client.delete_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_key,
        )
        logger.info("[storage] deleted R2 object: %s", object_key)
        return True
    except Exception as exc:
        logger.warning("Error al eliminar objeto R2 %s: %s", object_key, exc)
        return False


def build_public_asset_url(path: Optional[str]) -> Optional[str]:
    """
    Construye la URL pública absoluta anteponiendo PUBLIC_ASSET_BASE_URL.
    Evita dobles barras y respeta rutas absolutas o externas.
    """
    if not path:
        return None

    path_str = str(path).strip()
    if not path_str:
        return None

    if (
        path_str.startswith("http://")
        or path_str.startswith("https://")
        or path_str.startswith("data:")
        or path_str.startswith("blob:")
    ):
        return path_str

    base_url = (settings.PUBLIC_ASSET_BASE_URL or "").strip()
    if not base_url:
        return path_str

    base_url = base_url.rstrip("/")
    if not path_str.startswith("/"):
        path_str = "/" + path_str

    return f"{base_url}{path_str}"
