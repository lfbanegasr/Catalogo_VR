import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

logger = logging.getLogger("routes_catalog_pdf_assets")

from api.routes_catalog_pdf import _target_store
from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from core.storage import MAX_IMAGE_SIZE_BYTES, build_public_asset_url, delete_asset_file, save_upload_file
from models.tenant import Usuario
from services.catalog_pdf import extract_palette_suggestions
from services.catalog_pdf.cover_storage import delete_catalog_cover


router = APIRouter(prefix="/api/catalog", tags=["Catalog PDF"])


def _read_reference_image(file: UploadFile) -> bytes:
    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/jpg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usa JPG, PNG o WEBP.")
    data = file.file.read(MAX_IMAGE_SIZE_BYTES + 1)
    file.file.close()
    if not data:
        raise HTTPException(status_code=400, detail="La imagen esta vacia")
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="La imagen excede el tamano maximo de 5MB")
    return data


@router.post(
    "/pdf/cover",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_upload_catalog_cover(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    current_tienda_id: UUID = Depends(get_current_tienda_id),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
):
    store = _target_store(
        db=db,
        current_user=current_user,
        current_tienda_id=current_tienda_id,
        tienda_ref=tienda_ref,
    )
    previous_cover = (store.theme_config or {}).get("catalog_pdf", {}).get("cover_url")
    cover_url = save_upload_file(file, "catalog-covers", store.id_tienda)
    theme_config = dict(store.theme_config or {})
    catalog_pdf = dict(theme_config.get("catalog_pdf") or {})
    catalog_pdf["cover_url"] = cover_url
    theme_config["catalog_pdf"] = catalog_pdf
    store.theme_config = theme_config
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_asset_file(cover_url)
        except Exception:
            pass
        raise

    if previous_cover and previous_cover != cover_url:
        try:
            delete_catalog_cover(previous_cover)
        except Exception as e:
            logger.warning("Error eliminando portada anterior de catalogo %s: %s", previous_cover, e)
    return {"cover_url": build_public_asset_url(cover_url)}


@router.delete(
    "/pdf/cover",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_clear_catalog_cover(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    current_tienda_id: UUID = Depends(get_current_tienda_id),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
):
    store = _target_store(
        db=db,
        current_user=current_user,
        current_tienda_id=current_tienda_id,
        tienda_ref=tienda_ref,
    )
    theme_config = dict(store.theme_config or {})
    catalog_pdf = dict(theme_config.get("catalog_pdf") or {})
    previous_cover = catalog_pdf.pop("cover_url", None)
    theme_config["catalog_pdf"] = catalog_pdf
    store.theme_config = theme_config
    db.commit()
    if previous_cover:
        delete_catalog_cover(previous_cover)
    return {"cover_url": None}


@router.post(
    "/pdf/palette",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_extract_catalog_palette(file: UploadFile = File(...)):
    try:
        return extract_palette_suggestions(_read_reference_image(file))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
