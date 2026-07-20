import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, UploadFile, status

from core.config import settings

logger = logging.getLogger("storage")

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def save_upload_file(file: UploadFile, subfolder: str, entity_id: UUID) -> str:
    """
    Validates and saves an UploadFile to a subfolder within the configured UPLOADS_DIR.
    Returns the relative web path (e.g. /uploads/products/xyz.jpg).
    """
    # 1. Validate that the file is not empty by seeking
    try:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
    except Exception:
        # Fallback to reading file if seek is unsupported
        content = file.file.read()
        size = len(content)
        file.file.seek(0)

    if size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    # 2. Validate maximum image size (5MB)
    if size > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen excede el tamaño máximo de 5MB.",
        )

    # 3. Validate image type
    content_type = (file.content_type or "").lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no permitido. Usa JPG, PNG o WEBP.",
        )

    # 4. Generate unique, secure name to prevent path traversal
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    filename = f"{entity_id}_{timestamp}{ext}"

    # 5. Resolve target directory and final path
    uploads_base_path = settings.UPLOADS_PATH
    target_dir = uploads_base_path / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)
    destination = (target_dir / filename).resolve()

    # 6. Verify path traversal safety
    if not str(destination).startswith(str(uploads_base_path)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Intento de path traversal detectado.",
        )

    # 7. Safe binary write
    try:
        with destination.open("wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    finally:
        file.file.close()

    # 8. Verify destination exists and has content
    if not destination.exists() or destination.stat().st_size == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al guardar la imagen.",
        )

    public_path = f"/uploads/{subfolder}/{filename}"
    saved_size = destination.stat().st_size

    # 9. Format logs exactly as expected in Phase 9
    print(f"[storage] saved={destination.as_posix()}", flush=True)
    print(f"[storage] size={saved_size}", flush=True)
    print(f"[storage] public_path={public_path}", flush=True)

    return public_path


def build_public_asset_url(path: Optional[str]) -> Optional[str]:
    """
    Builds the absolute public asset URL by prepending PUBLIC_ASSET_BASE_URL.
    Avoids double slashes and respects absolute / external paths.
    """
    if not path:
        return None

    path_str = str(path).strip()
    if not path_str:
        return None

    # Return unchanged if already absolute or data URI
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

    # Clean double slashes
    base_url = base_url.rstrip("/")
    if not path_str.startswith("/"):
        path_str = "/" + path_str

    return f"{base_url}{path_str}"
