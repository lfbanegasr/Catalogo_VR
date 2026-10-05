#!/usr/bin/env python3
"""
optimize_existing_images.py
---------------------------
Script seguro e idempotente para optimizar imágenes locales existentes a WebP.

SEGURIDAD Y COMPORTAMIENTO:
  1. El comportamiento por defecto (sin argumentos) es DRY-RUN REAL:
     - No escribe archivos.
     - No renombra archivos.
     - No elimina archivos.
     - No modifica la base de datos.
     - Calcula el tamaño real convirtiendo a WebP en memoria (sin porcentajes inventados).
  2. Para aplicar cambios reales se requiere explícitamente el flag: --apply.
  3. Durante --apply:
     - Se genera y valida el WebP en disco (.tmp -> .webp).
     - Se valida que el WebP sea completamente legible por Pillow.
     - Se actualizan las referencias en base de datos de manera obligatoria y atómica:
         * productos.imagen_url
         * producto_imagenes.imagen_url
         * ofertas.banner_url
         * variantes_producto.imagen_url
         * tiendas.theme_config (recorrido recursivo de JSON)
     - Si la transacción de base de datos falla, se hace rollback inmediato,
       se conserva el archivo original intacto y se elimina únicamente el WebP nuevo.
     - El archivo original NUNCA se elimina antes de confirmar la transacción (commit).
  4. Almacenamiento R2:
     - Este script opera exclusivamente sobre el almacenamiento local.
     - Las URLs de R2 (http:// o https://) son detectadas y omitidas de forma segura,
       informando el total en el resumen final.
"""

from __future__ import annotations

import argparse
import io
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Agregar backend/ al sys.path para resolver imports del proyecto
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from core.config import settings  # noqa: E402
from core.image_pipeline import process_image  # noqa: E402

try:
    from PIL import Image, UnidentifiedImageError
except ImportError:
    print("ERROR: Pillow no está instalado. Ejecuta: pip install Pillow")
    sys.exit(1)


OPTIMIZABLE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@dataclass
class MigrationStats:
    encontradas: int = 0
    convertibles: int = 0
    convertidas: int = 0
    referencias_bd_actualizadas: int = 0
    originales_conservados: int = 0
    omitidas: int = 0
    omitidas_r2: int = 0
    conflictos: int = 0
    errores: int = 0
    bytes_antes: int = 0
    bytes_despues: int = 0
    detalle_errores: list[str] = field(default_factory=list)


def is_external_url(url: str | None) -> bool:
    if not url:
        return False
    u = str(url).strip()
    return u.startswith("http://") or u.startswith("https://")


def find_local_images(uploads_path: Path, subfolder: str | None = None) -> list[Path]:
    """Encuentra todas las imágenes JPG/PNG en el directorio local de uploads."""
    uploads_resolved = uploads_path.resolve()
    if subfolder:
        search_root = (uploads_resolved / subfolder).resolve()
        try:
            if not search_root.is_relative_to(uploads_resolved) or search_root == uploads_resolved.parent:
                raise ValueError(f"Path traversal detectado en subfolder: {subfolder}")
        except (ValueError, Exception) as exc:
            raise ValueError(f"Path traversal detectado en subfolder: {subfolder}") from exc
    else:
        search_root = uploads_resolved

    if not search_root.exists():
        return []

    images: list[Path] = []
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        images.extend(search_root.rglob(f"*{ext}"))
        images.extend(search_root.rglob(f"*{ext.upper()}"))

    safe_images = []
    for img in sorted(set(images)):
        resolved_img = img.resolve()
        try:
            if resolved_img.is_relative_to(uploads_resolved):
                safe_images.append(resolved_img)
        except ValueError:
            continue
    return safe_images


def _replace_in_json_tree(obj: any, old_url: str, new_url: str) -> tuple[any, int]:
    """Recorre recursivamente un objeto JSON y reemplaza ocurrencias exactas de old_url."""
    count = 0
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            new_v, sub_count = _replace_in_json_tree(v, old_url, new_url)
            new_dict[k] = new_v
            count += sub_count
        return new_dict, count
    elif isinstance(obj, list):
        new_list = []
        for item in obj:
            new_item, sub_count = _replace_in_json_tree(item, old_url, new_url)
            new_list.append(new_item)
            count += sub_count
        return new_list, count
    elif isinstance(obj, str):
        if obj == old_url:
            return new_url, 1
        return obj, 0
    return obj, 0


def update_database_references(db, old_url: str, new_url: str) -> int:
    """
    Actualiza atómicamente todas las referencias de old_url a new_url en la BD:
      - productos.imagen_url
      - producto_imagenes.imagen_url
      - ofertas.banner_url
      - variantes_producto.imagen_url
      - tiendas.theme_config (recorrido de JSON)

    Retorna el número total de referencias actualizadas.
    """
    from sqlalchemy import text
    from models.tenant import Tienda

    total_updates = 0

    # 1. Tablas columna directa
    targets = [
        ("productos", "imagen_url"),
        ("producto_imagenes", "imagen_url"),
        ("ofertas", "banner_url"),
        ("variantes_producto", "imagen_url"),
    ]

    for table, col in targets:
        stmt = text(f"UPDATE {table} SET {col} = :new_val WHERE {col} = :old_val")
        result = db.execute(stmt, {"new_val": new_url, "old_val": old_url})
        if result.rowcount > 0:
            total_updates += result.rowcount

    # 2. Recorrido de theme_config en tiendas
    tiendas = db.query(Tienda).filter(Tienda.theme_config.isnot(None)).all()
    for tienda in tiendas:
        cfg = tienda.theme_config
        if isinstance(cfg, (dict, list)):
            updated_cfg, count = _replace_in_json_tree(cfg, old_url, new_url)
            if count > 0:
                tienda.theme_config = updated_cfg
                total_updates += count

    return total_updates


def count_r2_references_in_db(db) -> int:
    """Cuenta cuántas referencias en la base de datos apuntan a URLs externas/R2."""
    from sqlalchemy import text

    count = 0
    queries = [
        "SELECT COUNT(*) FROM productos WHERE imagen_url LIKE 'http%'",
        "SELECT COUNT(*) FROM producto_imagenes WHERE imagen_url LIKE 'http%'",
        "SELECT COUNT(*) FROM ofertas WHERE banner_url LIKE 'http%'",
        "SELECT COUNT(*) FROM variantes_producto WHERE imagen_url LIKE 'http%'",
    ]
    for q in queries:
        try:
            res = db.execute(text(q)).scalar()
            count += int(res or 0)
        except Exception:
            pass
    return count


def check_url_referenced_in_db(db, url: str) -> bool:
    """Verifica si una URL exacta aún está referenciada en alguna tabla."""
    from sqlalchemy import text
    from models.tenant import Tienda

    for table, col in [
        ("productos", "imagen_url"),
        ("producto_imagenes", "imagen_url"),
        ("ofertas", "banner_url"),
        ("variantes_producto", "imagen_url"),
    ]:
        stmt = text(f"SELECT 1 FROM {table} WHERE {col} = :val LIMIT 1")
        if db.execute(stmt, {"val": url}).first():
            return True

    tiendas = db.query(Tienda).filter(Tienda.theme_config.isnot(None)).all()
    for t in tiendas:
        _, c = _replace_in_json_tree(t.theme_config, url, url)
        if c > 0:
            return True

    return False


def run_migration(
    uploads_path: Path,
    *,
    subfolder: str | None = None,
    quality: int = 82,
    apply: bool = False,
    verbose: bool = False,
    db_session_factory=None,
) -> MigrationStats:
    """
    Ejecuta el proceso de migración o simulación.
    Retorna objeto MigrationStats con el resumen consolidado.
    """
    stats = MigrationStats()

    uploads_resolved = uploads_path.resolve()
    if not uploads_resolved.exists():
        stats.errores += 1
        stats.detalle_errores.append(f"El directorio no existe: {uploads_path}")
        return stats

    if subfolder:
        try:
            target_sub = (uploads_resolved / subfolder).resolve()
            if not target_sub.is_relative_to(uploads_resolved) or target_sub == uploads_resolved.parent:
                raise ValueError(f"Path traversal detectado en subfolder: {subfolder}")
        except Exception as exc:
            stats.errores += 1
            stats.detalle_errores.append(str(exc))
            return stats

    try:
        images = find_local_images(uploads_resolved, subfolder)
    except Exception as exc:
        stats.errores += 1
        stats.detalle_errores.append(f"Error al buscar imágenes: {exc}")
        return stats

    stats.encontradas = len(images)

    # Contar referencias externas / R2 en la base de datos
    db_session = None
    if db_session_factory:
        db_session = db_session_factory()
    else:
        try:
            from core.database import SessionLocal
            db_session = SessionLocal()
        except Exception as exc:
            if apply:
                stats.errores += 1
                stats.detalle_errores.append(f"No se pudo conectar a la base de datos: {exc}")
                return stats

    if db_session:
        try:
            stats.omitidas_r2 = count_r2_references_in_db(db_session)
        except Exception:
            stats.omitidas_r2 = 0

    # -------------------------------------------------------------
    # FASE DE DETECCIÓN DE CONFLICTOS PREVIA A LA CONVERSIÓN
    # -------------------------------------------------------------
    convertible_images = [img for img in images if img.suffix.lower() in OPTIMIZABLE_EXTENSIONS]

    dest_map: dict[Path, list[Path]] = {}
    for img in convertible_images:
        dest_webp = img.with_suffix(".webp")
        dest_map.setdefault(dest_webp, []).append(img)

    conflicts: dict[Path, str] = {}
    for dest_webp, sources in dest_map.items():
        if len(sources) > 1:
            src_names = ", ".join(s.name for s in sources)
            for s in sources:
                conflicts[s] = f"Colisión múltiple: múltiples originales ({src_names}) convergen al mismo destino {dest_webp.name}. Requiere revisión manual."
        if dest_webp.exists():
            for s in sources:
                if s not in conflicts:
                    conflicts[s] = f"Colisión con archivo existente: el destino {dest_webp.name} ya existe previamente en disco. Requiere revisión manual."

    for img, reason in conflicts.items():
        stats.conflictos += 1
        stats.originales_conservados += 1
        stats.errores += 1
        stats.detalle_errores.append(f"[CONFLICTO] {img.name}: {reason}")
        if verbose:
            print(f"  [CONFLICTO - REVISIÓN MANUAL] {img.name} → {reason}")

    # -------------------------------------------------------------
    # FASE DE PROCESAMIENTO / CONVERSIÓN
    # -------------------------------------------------------------
    for img_path in images:
        # 1. Si ya es WebP, omitir (no contar como convertida)
        if img_path.suffix.lower() == ".webp":
            stats.omitidas += 1
            if verbose:
                print(f"  [OMITIDA] Ya es WebP: {img_path.name}")
            continue

        # 2. Si está en conflicto, no convertir, no tocar BD, original ya conservado
        if img_path in conflicts:
            continue

        if img_path.suffix.lower() not in OPTIMIZABLE_EXTENSIONS:
            continue

        stats.convertibles += 1
        bytes_orig = img_path.stat().st_size
        stats.bytes_antes += bytes_orig

        dest_webp = img_path.with_suffix(".webp")
        rel_old = f"/uploads/{img_path.relative_to(uploads_resolved).as_posix()}"
        rel_new = f"/uploads/{dest_webp.relative_to(uploads_resolved).as_posix()}"

        try:
            raw = img_path.read_bytes()
        except Exception as exc:
            stats.errores += 1
            stats.originales_conservados += 1
            stats.detalle_errores.append(f"Error al leer {img_path.name}: {exc}")
            continue

        # Si estamos en modo DRY-RUN (sin --apply)
        if not apply:
            try:
                # Convertir en memoria para calcular el peso real
                webp_bytes = process_image(
                    raw,
                    max_width=settings.IMAGE_MAX_WIDTH,
                    max_height=settings.IMAGE_MAX_HEIGHT,
                    max_pixels=settings.IMAGE_MAX_PIXELS,
                    quality=quality,
                )
                real_webp_size = len(webp_bytes)
                stats.bytes_despues += real_webp_size
                stats.originales_conservados += 1
                if verbose:
                    diff = bytes_orig - real_webp_size
                    pct = int(diff / bytes_orig * 100) if bytes_orig > 0 else 0
                    print(
                        f"  [DRY-RUN] {img_path.name}: {bytes_orig:,} → {real_webp_size:,} bytes "
                        f"({pct}% ahorro real en memoria)"
                    )
            except Exception as exc:
                stats.errores += 1
                stats.originales_conservados += 1
                stats.detalle_errores.append(f"Error al simular conversión de {img_path.name}: {exc}")
            continue

        # Modo --apply REAL
        try:
            webp_bytes = process_image(
                raw,
                max_width=settings.IMAGE_MAX_WIDTH,
                max_height=settings.IMAGE_MAX_HEIGHT,
                max_pixels=settings.IMAGE_MAX_PIXELS,
                quality=quality,
            )
        except Exception as exc:
            stats.errores += 1
            stats.originales_conservados += 1
            stats.detalle_errores.append(f"Error de conversión para {img_path.name}: {exc}")
            continue

        # Escribir en archivo temporal y renombrar atómicamente
        tmp_dest = dest_webp.with_suffix(".tmp")
        try:
            tmp_dest.write_bytes(webp_bytes)
            tmp_dest.replace(dest_webp)
        except Exception as exc:
            tmp_dest.unlink(missing_ok=True)
            stats.errores += 1
            stats.originales_conservados += 1
            stats.detalle_errores.append(f"Error al escribir {dest_webp.name}: {exc}")
            continue

        # Validar completamente que el archivo escrito puede abrirse
        dest_readable = False
        try:
            with Image.open(dest_webp) as test_img:
                test_img.load()
                dest_readable = True
        except Exception as exc:
            dest_webp.unlink(missing_ok=True)
            stats.errores += 1
            stats.originales_conservados += 1
            stats.detalle_errores.append(
                f"El archivo WebP resultante no es legible: {exc}. Original conservado."
            )
            continue

        # Transacción de base de datos obligatoria
        if db_session:
            try:
                refs_updated = update_database_references(db_session, rel_old, rel_new)
                db_session.commit()
                stats.referencias_bd_actualizadas += refs_updated
            except Exception as exc:
                db_session.rollback()
                # Eliminar el WebP nuevo creado durante este intento fallido
                dest_webp.unlink(missing_ok=True)
                stats.errores += 1
                stats.originales_conservados += 1
                stats.detalle_errores.append(
                    f"Fallo en transacción de BD para {img_path.name}: {exc}. "
                    f"Rollback aplicado y original conservado."
                )
                continue
        else:
            dest_webp.unlink(missing_ok=True)
            stats.errores += 1
            stats.originales_conservados += 1
            stats.detalle_errores.append("Actualización de base de datos obligatoria en modo --apply.")
            continue

        # Confirmación total: solo ahora se elimina el archivo original
        try:
            img_path.unlink()
        except Exception as exc:
            stats.originales_conservados += 1
            print(f"  [WARN] No se pudo eliminar el original {img_path.name}: {exc}")

        stats.convertidas += 1
        stats.bytes_despues += len(webp_bytes)
        if verbose:
            print(f"  [CONVERTIDO] {img_path.name} → {dest_webp.name}")

    if db_session:
        db_session.close()

    return stats


def print_summary(stats: MigrationStats, is_apply: bool) -> None:
    """Imprime el resumen con todos los campos obligatorios del requerimiento."""
    print(f"\n{'='*60}")
    print(f"  RESUMEN DE MIGRACIÓN DE IMÁGENES")
    print(f"  Modo: {'APPLY (Cambios aplicados)' if is_apply else 'DRY-RUN (Sin cambios en disco ni BD)'}")
    print(f"{'='*60}")
    print(f"  Imágenes encontradas:              {stats.encontradas:,}")
    print(f"  Imágenes convertibles:             {stats.convertibles:,}")
    print(f"  Imágenes convertidas a WebP:       {stats.convertidas:,}")
    print(f"  Referencias de BD actualizadas:    {stats.referencias_bd_actualizadas:,}")
    print(f"  Originales conservados:            {stats.originales_conservados:,}")
    print(f"  Imágenes omitidas (ya WebP):       {stats.omitidas:,}")
    print(f"  Imágenes omitidas (R2 / remotas):  {stats.omitidas_r2:,}")
    print(f"  Conflictos (revisión manual):      {stats.conflictos:,}")
    print(f"  Errores registrados:               {stats.errores:,}")

    if stats.bytes_antes > 0 and stats.bytes_despues > 0:
        savings = stats.bytes_antes - stats.bytes_despues
        pct = int(savings / stats.bytes_antes * 100) if stats.bytes_antes > 0 else 0
        print(f"\n  Tamaño antes:  {stats.bytes_antes / (1024 * 1024):.2f} MB ({stats.bytes_antes:,} bytes)")
        print(f"  Tamaño después:{stats.bytes_despues / (1024 * 1024):.2f} MB ({stats.bytes_despues:,} bytes)")
        print(f"  Ahorro real:   {savings / (1024 * 1024):.2f} MB ({pct}% ahorro)")

    if not is_apply:
        print("\n  [INFO] Modo simulacion (DRY-RUN). Ningun archivo ni registro fue modificado.")
        print("         Para aplicar cambios reales use: python scripts/optimize_existing_images.py --apply")

    if stats.detalle_errores:
        print(f"\n  Detalle de errores ({len(stats.detalle_errores)}):")
        for err in stats.detalle_errores:
            print(f"    - {err}")

    print(f"{'='*60}\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Optimiza imágenes locales convirtiéndolas a WebP de forma segura e idempotente.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Aplica los cambios reales en disco y base de datos. Sin este flag se ejecuta en DRY-RUN.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="[Por defecto] Solo calcula y muestra estadísticas en memoria sin modificar archivos.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=settings.IMAGE_WEBP_QUALITY,
        metavar="INT",
        help=f"Calidad WebP (1-100). Por defecto: {settings.IMAGE_WEBP_QUALITY}.",
    )
    parser.add_argument(
        "--subfolder",
        type=str,
        default=None,
        metavar="STR",
        help="Procesar solo un subfolder (ej: 'products', 'offers', 'theme').",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Mostrar detalles por cada archivo procesado.",
    )

    args = parser.parse_args()

    # Si se pasa --apply, entonces no es dry_run
    is_apply = args.apply
    uploads_path = settings.UPLOADS_PATH

    print(f"\n{'='*60}")
    print("  Optimizador Seguro de Imágenes — Catalogo VR")
    print(f"{'='*60}")
    print(f"  Directorio uploads: {uploads_path}")
    print(f"  Subfolder:          {args.subfolder or '(todos)'}")
    print(f"  Calidad WebP:       {args.quality}")
    print(f"  Modo de ejecución:  {'¡APPLY REAL!' if is_apply else 'DRY-RUN (Simulación segura en memoria)'}")
    print(f"{'='*60}\n")

    stats = run_migration(
        uploads_path,
        subfolder=args.subfolder,
        quality=args.quality,
        apply=is_apply,
        verbose=args.verbose,
    )
    print_summary(stats, is_apply=is_apply)


if __name__ == "__main__":
    main()
