from __future__ import annotations

import ipaddress
import logging
from decimal import Decimal
from io import BytesIO
from math import cos, pi, sin
from pathlib import Path
import socket
import urllib.parse
import urllib.request
import warnings
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlsplit

from PIL import Image, ImageColor, ImageOps, UnidentifiedImageError
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth

from core.config import settings

logger = logging.getLogger("catalog_pdf")

PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_MARGIN = 38
MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024


def safe_text(value: object, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    return text.encode("cp1252", "replace").decode("cp1252")


def _safe_log_url(url: str) -> str:
    try:
        p = urlsplit(url)
        host = p.hostname or "unknown"
        port_part = f":{p.port}" if p.port else ""
        return f"{p.scheme}://{host}{port_part}{p.path}"
    except Exception:
        return "<invalid-url>"


def is_ip_allowed(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return False

    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ipv4 = ip.ipv4_mapped
        if (
            ipv4.is_private
            or ipv4.is_loopback
            or ipv4.is_link_local
            or ipv4.is_multicast
            or ipv4.is_reserved
            or ipv4.is_unspecified
        ):
            return False

    return True


def get_allowed_remote_origins(allowed_base_urls: list[str] | None = None) -> list[urllib.parse.SplitResult]:
    origins = []
    candidates = (
        allowed_base_urls
        if allowed_base_urls is not None
        else [
            getattr(settings, "R2_PUBLIC_BASE_URL", ""),
            getattr(settings, "PUBLIC_ASSET_BASE_URL", ""),
            getattr(settings, "PRODUCT_IMAGE_BASE_URL", ""),
        ]
    )
    for raw in candidates:
        if not raw:
            continue
        val = str(raw).strip()
        if not val:
            continue
        try:
            parsed = urlsplit(val)
            if parsed.scheme.lower() in ("https", "http") and parsed.hostname:
                origins.append(parsed)
        except Exception:
            continue
    return origins


def is_safe_remote_url(
    url: str,
    allowed_base_urls: list[str] | None = None,
    *,
    resolve_dns: bool = True,
) -> tuple[bool, str]:
    if not url or not isinstance(url, str):
        return False, "URL vacia o invalida"

    try:
        parsed = urlsplit(url.strip())
    except Exception:
        return False, "URL malformada"

    scheme = (parsed.scheme or "").lower()
    if scheme not in ("https", "http"):
        return False, f"Esquema no permitido: {scheme}"

    if parsed.username or parsed.password or "@" in (parsed.netloc or ""):
        return False, "URL contiene credenciales"

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, "URL sin hostname"

    if hostname == "localhost" or hostname.endswith(".localhost"):
        return False, "Acceso a localhost denegado"

    try:
        ip_lit = ipaddress.ip_address(hostname.strip("[]"))
        if not is_ip_allowed(str(ip_lit)):
            return False, f"Direccion IP restringida: {ip_lit}"
    except ValueError:
        pass

    allowed_origins = get_allowed_remote_origins(allowed_base_urls)
    if not allowed_origins:
        return False, "No hay origenes remotos configurados"

    matched = False
    for origin in allowed_origins:
        if scheme != origin.scheme.lower():
            continue
        if hostname != (origin.hostname or "").lower():
            continue
        candidate_port = parsed.port or (443 if scheme == "https" else 80)
        origin_port = origin.port or (443 if origin.scheme.lower() == "https" else 80)
        if candidate_port != origin_port:
            continue
        origin_path = (origin.path or "").rstrip("/")
        if origin_path:
            candidate_path = parsed.path or "/"
            if not (candidate_path == origin_path or candidate_path.startswith(origin_path + "/")):
                continue
        matched = True
        break

    if not matched:
        return False, f"Origen no autorizado: {hostname}"

    if resolve_dns:
        candidate_port = parsed.port or (443 if scheme == "https" else 80)
        try:
            addr_info = socket.getaddrinfo(hostname, candidate_port, proto=socket.IPPROTO_TCP)
        except (socket.gaierror, socket.herror, OSError) as exc:
            return False, f"Fallo en resolucion DNS para {hostname}: {exc}"

        if not addr_info:
            return False, f"No se obtuvieron registros DNS para {hostname}"

        for entry in addr_info:
            ip_str = entry[4][0]
            if not is_ip_allowed(ip_str):
                return False, f"El host {hostname} resuelve a direccion no permitida: {ip_str}"

    return True, ""


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_base_urls: list[str] | None = None, max_redirects: int = 3):
        super().__init__()
        self.allowed_base_urls = allowed_base_urls
        self.max_redirects = max_redirects
        self.redirects_followed = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.redirects_followed += 1
        if self.redirects_followed > self.max_redirects:
            logger.warning("Limite de redirecciones excedido en descarga de imagen PDF")
            return None

        target_url = urllib.parse.urljoin(req.full_url, newurl)
        safe, reason = is_safe_remote_url(target_url, self.allowed_base_urls, resolve_dns=True)
        if not safe:
            logger.warning("Redireccion bloqueada por politica de seguridad: %s", reason)
            return None

        return super().redirect_request(req, fp, code, msg, headers, target_url)


def validate_image_pixels(data: bytes, max_pixels: int | None = None) -> bool:
    if not data:
        return False
    limit = max_pixels if max_pixels is not None else getattr(settings, "IMAGE_MAX_PIXELS", 25_000_000)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as img:
                w, h = img.size
                if w * h > limit:
                    logger.warning(
                        "Imagen rechazada: dimensiones %dx%d (%d px) exceden limite de %d px",
                        w, h, w * h, limit,
                    )
                    return False
        return True
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        logger.warning("Bomba de descompresion detectada en imagen")
        return False
    except Exception:
        return False


def asset_bytes(path_or_url: str | None, allowed_base_urls: list[str] | None = None) -> bytes | None:
    value = str(path_or_url or "").strip()
    if not value:
        return None

    if value.startswith("http://") or value.startswith("https://"):
        safe, reason = is_safe_remote_url(value, allowed_base_urls, resolve_dns=True)
        if not safe:
            logger.warning("Descarga remota bloqueada por seguridad: %s", reason)
            return None

        request = urllib.request.Request(value, headers={"User-Agent": "CatalogPdf/2.0"})
        opener = urllib.request.build_opener(SafeRedirectHandler(allowed_base_urls))
        try:
            with opener.open(request, timeout=8) as response:
                content_type = str(response.headers.get("Content-Type", "")).lower()
                if content_type and not content_type.startswith("image/"):
                    logger.warning("Content-Type remoto no es imagen: %s", content_type)
                    return None
                data = response.read(MAX_REMOTE_IMAGE_BYTES + 1)
                if len(data) > MAX_REMOTE_IMAGE_BYTES:
                    logger.warning("Archivo remoto excede limite (%d bytes)", MAX_REMOTE_IMAGE_BYTES)
                    return None
                if not validate_image_pixels(data):
                    return None
                return data
        except Exception as exc:
            logger.warning("Fallo al descargar imagen remota %s: %s", _safe_log_url(value), exc)
            return None

    parsed_path = urlparse(value).path.replace("\\", "/")
    if parsed_path.startswith("/uploads/"):
        relative = parsed_path[len("/uploads/"):]
    elif parsed_path.startswith("uploads/"):
        relative = parsed_path[len("uploads/"):]
    else:
        return None

    base_uploads = settings.UPLOADS_PATH.resolve()
    candidate = (base_uploads / relative).resolve()
    try:
        if not candidate.is_relative_to(base_uploads):
            logger.warning("Intento de path traversal bloqueado: %s", relative)
            return None
    except (ValueError, AttributeError):
        return None

    try:
        if not candidate.is_file() or candidate.stat().st_size > MAX_REMOTE_IMAGE_BYTES:
            return None
        data = candidate.read_bytes()
        if not validate_image_pixels(data):
            return None
        return data
    except OSError:
        return None


def prepared_image(
    path_or_url: str | None,
    *,
    width_px: int,
    height_px: int,
    background: str,
    fit: str = "contain",
    position_x: int = 50,
    position_y: int = 50,
    zoom: int = 100,
) -> BytesIO | None:
    data = asset_bytes(path_or_url)
    if not data:
        return None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as img_check:
                w, h = img_check.size
                if w * h > getattr(settings, "IMAGE_MAX_PIXELS", 25_000_000):
                    return None
                source = img_check.convert("RGBA")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return None

    target_size = (max(20, width_px), max(20, height_px))
    try:
        bg_rgb = ImageColor.getrgb(background)
    except ValueError:
        bg_rgb = (248, 245, 242)
    frame = Image.new("RGBA", target_size, (*bg_rgb, 255))
    normalized_fit = fit if fit in {"cover", "contain"} else "contain"
    centering = (
        max(0, min(100, position_x)) / 100,
        max(0, min(100, position_y)) / 100,
    )
    scale = max(0.8, min(2, zoom / 100))
    if normalized_fit == "cover":
        scaled_size = (
            max(target_size[0], round(target_size[0] * scale)),
            max(target_size[1], round(target_size[1] * scale)),
        )
        composed = ImageOps.fit(source, scaled_size, Image.Resampling.LANCZOS, centering=centering)
        if composed.size != target_size:
            composed = ImageOps.fit(composed, target_size, Image.Resampling.LANCZOS, centering=centering)
        frame.alpha_composite(composed)
    else:
        contained = ImageOps.contain(source, target_size, Image.Resampling.LANCZOS)
        if scale != 1:
            contained = contained.resize(
                (max(1, round(contained.width * scale)), max(1, round(contained.height * scale))),
                Image.Resampling.LANCZOS,
            )
        x = round((target_size[0] - contained.width) * centering[0])
        y = round((target_size[1] - contained.height) * (1 - centering[1]))
        frame.alpha_composite(contained, (x, y))

    output = BytesIO()
    frame.convert("RGB").save(output, format="JPEG", quality=90, optimize=True)
    output.seek(0)
    return output


def wrap_lines(text: str, font: str, size: float, max_width: float, max_lines: int) -> list[str]:
    words = safe_text(text).split()
    if not words:
        return []
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) == max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(" ".join(lines).split()) < len(words) and lines:
        while lines[-1] and stringWidth(lines[-1] + "...", font, size) > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + "..."
    return lines


def draw_lines(pdf, lines, *, x, y, font, size, color, leading) -> float:
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    cursor = y
    for line in lines:
        pdf.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def money(value: Decimal | float | int, symbol: str) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    rendered = f"{amount:,.2f}".replace(",", " ")
    return f"{safe_text(symbol, 'Bs')} {rendered}"


def category_label(category, by_id: dict[object, object]) -> str:
    names = [safe_text(category.nombre, "Categoria")]
    visited = {category.id_categoria}
    parent_id = category.id_categoria_padre
    while parent_id and parent_id in by_id and parent_id not in visited:
        visited.add(parent_id)
        parent = by_id[parent_id]
        names.insert(0, safe_text(parent.nombre, "Categoria"))
        parent_id = parent.id_categoria_padre
    return " / ".join(names)


def contrast_text(hex_color: str) -> Color:
    try:
        r, g, b = ImageColor.getrgb(hex_color)
    except ValueError:
        return white
    luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return HexColor("#241F24") if luminance > 0.62 else white


def draw_background(pdf, options, page_index: int = 0) -> None:
    background = HexColor(options.background_color)
    end = HexColor(options.gradient_end_color)
    style = options.background_style
    if style in {"gradient", "organic"}:
        pdf.linearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT, (background, end), extend=False)
    else:
        pdf.setFillColor(background)
        pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    if style == "organic":
        pdf.saveState()
        pdf.setFillAlpha(0.13 if options.decorative_intensity == "subtle" else 0.22)
        pdf.setFillColor(HexColor(options.secondary_color))
        pdf.circle(PAGE_WIDTH - 30, PAGE_HEIGHT - 80, 118, fill=1, stroke=0)
        pdf.setFillColor(HexColor(options.primary_color))
        pdf.circle(22, 118 + (page_index % 2) * 45, 92, fill=1, stroke=0)
        pdf.setStrokeColor(HexColor(options.primary_color))
        pdf.setLineWidth(1.2)
        pdf.circle(PAGE_WIDTH - 72, 92, 58, fill=0, stroke=1)
        pdf.circle(PAGE_WIDTH - 72, 92, 72, fill=0, stroke=1)
        pdf.restoreState()
    elif style == "editorial":
        pdf.saveState()
        pdf.setFillAlpha(0.16)
        pdf.setFillColor(HexColor(options.secondary_color))
        path = pdf.beginPath()
        path.moveTo(PAGE_WIDTH * 0.62, PAGE_HEIGHT)
        path.lineTo(PAGE_WIDTH, PAGE_HEIGHT)
        path.lineTo(PAGE_WIDTH, PAGE_HEIGHT * 0.55)
        path.close()
        pdf.drawPath(path, fill=1, stroke=0)
        pdf.setFillColor(HexColor(options.primary_color))
        pdf.rect(0, 0, 12, PAGE_HEIGHT, fill=1, stroke=0)
        pdf.restoreState()


def image_settings(product, category, options, *, default_fit="contain") -> tuple[str, str, int, int, int]:
    background = product.imagen_fondo or getattr(category, "imagen_fondo_default", None) or options.background_color
    inherited_fit = product.imagen_fit or getattr(category, "imagen_fit_default", default_fit) or default_fit
    fit = options.image_fit if options.image_fit != "auto" else inherited_fit
    return (
        background,
        "contain" if fit == "auto" else fit,
        product.imagen_posicion_x if product.imagen_posicion_x is not None else getattr(category, "imagen_posicion_x_default", 50),
        product.imagen_posicion_y if product.imagen_posicion_y is not None else getattr(category, "imagen_posicion_y_default", 50),
        product.imagen_zoom if product.imagen_zoom is not None else getattr(category, "imagen_zoom_default", 100),
    )


def draw_product_image(pdf, product, category, options, *, x, y, width, height, default_shape="rounded", default_fit="contain") -> None:
    background, fit, pos_x, pos_y, zoom = image_settings(product, category, options, default_fit=default_fit)
    image = prepared_image(
        product.imagen_url,
        width_px=max(320, round(width * 2.4)),
        height_px=max(280, round(height * 2.4)),
        background=background,
        fit=fit,
        position_x=pos_x,
        position_y=pos_y,
        zoom=zoom,
    )
    shape = options.image_shape if options.image_shape != "auto" else default_shape
    pdf.saveState()
    if shape == "circle":
        diameter = min(width, height)
        x += (width - diameter) / 2
        y += (height - diameter) / 2
        width = height = diameter
        clip = pdf.beginPath()
        clip.circle(x + width / 2, y + height / 2, width / 2)
        pdf.clipPath(clip, stroke=0, fill=0)
    elif shape == "rounded":
        clip = pdf.beginPath()
        clip.roundRect(x, y, width, height, min(14, width * 0.08))
        pdf.clipPath(clip, stroke=0, fill=0)
    if image:
        pdf.drawImage(ImageReader(image), x, y, width=width, height=height, mask="auto")
    else:
        pdf.setFillColor(HexColor(background))
        pdf.rect(x, y, width, height, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#978E97"))
        pdf.setFont("Helvetica", 9)
        pdf.drawCentredString(x + width / 2, y + height / 2, "Sin imagen")
    pdf.restoreState()


def draw_price_badge(pdf, price: str, options, *, x, y, width=78, style: str | None = None) -> None:
    badge_style = style or options.price_style
    fill = options.price_color
    text_color = contrast_text(fill)
    pdf.saveState()
    pdf.setFillColor(HexColor(fill))
    if badge_style == "circle":
        diameter = max(50, min(width, 72))
        pdf.circle(x + diameter / 2, y + diameter / 2, diameter / 2, fill=1, stroke=0)
        font_size = 9.5
        while font_size > 6 and stringWidth(price, "Helvetica-Bold", font_size) > diameter - 10:
            font_size -= 0.5
        pdf.setFillColor(text_color)
        pdf.setFont("Helvetica-Bold", font_size)
        pdf.drawCentredString(x + diameter / 2, y + diameter / 2 - 3, price)
    elif badge_style == "block":
        pdf.rect(x, y, width, 28, fill=1, stroke=0)
        pdf.setFillColor(text_color)
        pdf.setFont("Helvetica-Bold", 10.5)
        pdf.drawCentredString(x + width / 2, y + 9, price)
    else:
        pdf.roundRect(x, y, width, 28, 14, fill=1, stroke=0)
        pdf.setFillColor(text_color)
        pdf.setFont("Helvetica-Bold", 10.5)
        pdf.drawCentredString(x + width / 2, y + 9, price)
    pdf.restoreState()


def draw_header(pdf, store_name, category_name, options, page_number, *, align="left") -> None:
    text = HexColor(options.text_color)
    pdf.setFillColor(text)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(PAGE_MARGIN, PAGE_HEIGHT - 29, safe_text(store_name).upper())
    pdf.setFont("Helvetica-Bold", 18)
    if align == "center":
        pdf.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 63, safe_text(category_name))
    else:
        pdf.drawString(PAGE_MARGIN, PAGE_HEIGHT - 63, safe_text(category_name))
    pdf.setStrokeColor(HexColor(options.primary_color))
    pdf.setLineWidth(3)
    pdf.line(PAGE_MARGIN, PAGE_HEIGHT - 43, PAGE_MARGIN + 48, PAGE_HEIGHT - 43)
    pdf.setFillColor(text)
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(PAGE_WIDTH - PAGE_MARGIN, 22, f"PAGINA {page_number}")


def draw_decorative_spark(pdf, x: float, y: float, radius: float, color: str) -> None:
    pdf.saveState()
    pdf.setStrokeColor(HexColor(color))
    pdf.setLineWidth(0.8)
    path = pdf.beginPath()
    for index in range(8):
        angle = index * pi / 4
        length = radius if index % 2 == 0 else radius * 0.35
        px = x + cos(angle) * length
        py = y + sin(angle) * length
        if index == 0:
            path.moveTo(px, py)
        else:
            path.lineTo(px, py)
    path.close()
    pdf.drawPath(path, fill=0, stroke=1)
    pdf.restoreState()
