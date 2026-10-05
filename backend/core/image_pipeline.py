"""
image_pipeline.py
-----------------
Pipeline seguro de procesamiento de imágenes para Catalogo VR.

Responsabilidades:
  - Validar el contenido real del archivo (magic bytes), no sólo el MIME declarado.
  - Proteger contra decompression bombs, path traversal y archivos corruptos o truncados.
  - Leer como máximo IMAGE_MAX_INPUT_BYTES + 1 para evitar sobreconsumo de memoria.
  - Conservar la protección nativa de Pillow y aplicar además el límite configurable del proyecto.
  - Corregir orientación EXIF y eliminar metadatos innecesarios.
  - Redimensionar conservando la proporción (sin ampliar imágenes pequeñas).
  - Convertir a WebP optimizado con calidad configurable.
  - Uso riguroso de context managers para liberar descriptores de archivo y memoria.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

from fastapi import HTTPException, UploadFile, status

logger = logging.getLogger("image_pipeline")

# ──────────────────────────────────────────────────────────────────────────────
# Firmas de bytes conocidos (magic bytes) para validación real de contenido
# ──────────────────────────────────────────────────────────────────────────────
_IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "JPEG"),       # JPEG / JFIF / EXIF
    (b"\x89PNG\r\n\x1a\n", "PNG"),   # PNG
    (b"RIFF", "WEBP"),               # WebP (necesita verificación adicional)
]


def _detect_format_from_bytes(data: bytes) -> Optional[str]:
    """
    Detecta el formato real de la imagen a partir de los primeros bytes.
    Retorna 'JPEG', 'PNG', 'WEBP' o None si no se reconoce.
    """
    for signature, fmt in _IMAGE_SIGNATURES:
        if data[: len(signature)] == signature:
            if fmt == "WEBP":
                # WebP: bytes 8-12 deben ser b'WEBP'
                if len(data) >= 12 and data[8:12] == b"WEBP":
                    return "WEBP"
                return None  # RIFF pero no WebP
            return fmt
    return None


def read_and_validate_raw(
    file: UploadFile,
    *,
    max_bytes: int,
) -> bytes:
    """
    Lee como máximo max_bytes + 1 del archivo y aplica validaciones básicas:
      - Archivo no vacío.
      - Tamaño dentro del límite (max_bytes) sin cargar archivos arbitrariamente grandes.
      - Formato de imagen reconocido por magic bytes.

    Retorna el contenido crudo en bytes.
    Lanza HTTPException en caso de error.
    """
    try:
        file.file.seek(0)
        # Leer como máximo max_bytes + 1 para evitar cargar archivos gigantes en memoria
        raw = file.file.read(max_bytes + 1)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo leer el archivo.",
        ) from exc

    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    if len(raw) > max_bytes:
        mb = max_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen excede el tamaño máximo de {mb:.0f} MB.",
        )

    detected = _detect_format_from_bytes(raw)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no permitido. Usa JPG, PNG o WebP.",
        )

    return raw


def process_image(
    raw: bytes,
    *,
    max_width: int,
    max_height: int,
    max_pixels: int,
    quality: int,
) -> bytes:
    """
    Procesa la imagen:
      1. Verifica la integridad estructural de la imagen.
      2. Carga los píxeles y verifica contra el límite de píxeles (decompression bomb).
      3. Corrige la orientación EXIF preservando la rotación correcta.
      4. Elimina metadatos EXIF por privacidad convirtiendo a espacio de color limpio.
      5. Redimensiona conservando la proporción mediante Lanczos (sin ampliar).
      6. Convierte a WebP con la calidad especificada y libera recursos.

    Retorna los bytes WebP procesados.
    Lanza HTTPException (400 o 413) en caso de problemas.
    """
    import warnings
    from PIL import Image, ImageOps, UnidentifiedImageError

    # 1. Primera pasada: verificación estructural rápida
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as img_verify:
                # Obtener img.size inmediatamente después de abrir la imagen
                width, height = img_verify.size
                if width * height > max_pixels:
                    mpx = max_pixels / 1_000_000
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            f"La imagen tiene demasiados píxeles ({width * height:,} px). "
                            f"Máximo permitido: {mpx:.0f} Mpx."
                        ),
                    )
                img_verify.verify()
    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Bomba de descompresión detectada: {exc}",
        ) from exc
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo de imagen está corrupto o no es reconocido.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al validar la imagen.",
        ) from exc

    # 2. Segunda pasada: decodificación completa, verificación de píxeles y procesamiento
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as img:
                # Validar width * height antes de llamar a img.load()
                width, height = img.size
                if width * height > max_pixels:
                    mpx = max_pixels / 1_000_000
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            f"La imagen tiene demasiados píxeles ({width * height:,} px). "
                            f"Máximo permitido: {mpx:.0f} Mpx."
                        ),
                    )

                try:
                    img.load()
                except (OSError, SyntaxError) as exc:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La imagen está truncada o incompleta.",
                    ) from exc

                # Corregir orientación EXIF si está presente
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

                # Convertir a RGB/RGBA limpio (elimina metadatos EXIF)
                if img.mode in ("RGBA", "LA", "P"):
                    img_clean = img.convert("RGBA")
                else:
                    img_clean = img.convert("RGB")

                # Redimensionar conservando proporción (sin ampliar)
                current_w, current_h = img_clean.size
                if current_w > max_width or current_h > max_height:
                    img_clean.thumbnail((max_width, max_height), Image.LANCZOS)

                # Exportar a WebP
                output = io.BytesIO()
                save_kwargs: dict = {
                    "format": "WEBP",
                    "quality": quality,
                    "method": 4,  # balance compresión/velocidad
                }
                if img_clean.mode == "RGBA":
                    save_kwargs["lossless"] = False

                img_clean.save(output, **save_kwargs)
                return output.getvalue()
    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Bomba de descompresión detectada: {exc}",
        ) from exc
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo de imagen está corrupto o no se pudo decodificar.",
        ) from exc
    except Exception as exc:
        logger.exception("Error al procesar la imagen")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al procesar la imagen.",
        ) from exc
