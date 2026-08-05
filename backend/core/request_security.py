from __future__ import annotations

from ipaddress import ip_address

from starlette.requests import Request

from core.config import settings


def get_client_ip(request: Request) -> str:
    direct_ip = request.client.host if request.client else "unknown"
    if not settings.TRUST_PROXY_HEADERS:
        return direct_ip

    forwarded_for = request.headers.get("x-forwarded-for", "")
    candidate = forwarded_for.split(",", 1)[0].strip()
    if not candidate:
        return direct_ip
    try:
        return str(ip_address(candidate))
    except ValueError:
        return direct_ip
