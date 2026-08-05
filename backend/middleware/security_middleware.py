from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.config import settings
from core.request_security import get_client_ip


@dataclass(frozen=True)
class RateLimitRule:
    scope: str
    requests: int
    window_seconds: int = 60


def resolve_rate_limit(path: str, method: str) -> RateLimitRule | None:
    method = method.upper()
    if path in {"/api/auth/login", "/api/auth/login-json", "/api/auth/forgot-password", "/api/auth/reset-password"}:
        return RateLimitRule("auth", settings.RATE_LIMIT_AUTH_PER_MINUTE)
    if method == "POST" and path.endswith("/checkout") and path.startswith("/api/public/catalog/"):
        return RateLimitRule("checkout", settings.RATE_LIMIT_CHECKOUT_PER_MINUTE)
    if method == "POST" and (path.endswith("/events") or path.endswith("/whatsapp-click")):
        return RateLimitRule("events", settings.RATE_LIMIT_EVENTS_PER_MINUTE)
    if path.startswith("/api/public/"):
        return RateLimitRule("public", settings.RATE_LIMIT_PUBLIC_PER_MINUTE)
    return None


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._operations = 0

    def allow(self, key: str, rule: RateLimitRule, now: float | None = None) -> tuple[bool, int]:
        now = time.monotonic() if now is None else now
        cutoff = now - rule.window_seconds
        bucket = self._requests[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= rule.requests:
            retry_after = max(1, int(rule.window_seconds - (now - bucket[0])) + 1)
            return False, retry_after
        bucket.append(now)
        self._operations += 1
        if self._operations % 1000 == 0:
            self._remove_empty(cutoff)
        return True, 0

    def _remove_empty(self, cutoff: float) -> None:
        for key, bucket in list(self._requests.items()):
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if not bucket:
                self._requests.pop(key, None)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._limiter = SlidingWindowLimiter()

    async def dispatch(self, request: Request, call_next) -> Response:
        if settings.RATE_LIMIT_ENABLED:
            rule = resolve_rate_limit(request.url.path, request.method)
            if rule and rule.requests > 0:
                key = f"{rule.scope}:{get_client_ip(request)}"
                allowed, retry_after = self._limiter.allow(key, rule)
                if not allowed:
                    return JSONResponse(
                        {"detail": "Demasiadas solicitudes. Intenta nuevamente m?s tarde."},
                        status_code=429,
                        headers={"Retry-After": str(retry_after)},
                    )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
