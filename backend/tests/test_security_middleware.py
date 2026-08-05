import unittest
from unittest.mock import patch

from middleware.security_middleware import RateLimitRule, SlidingWindowLimiter, resolve_rate_limit


class SecurityMiddlewareTests(unittest.TestCase):
    def test_login_uses_strict_limit(self) -> None:
        with patch("middleware.security_middleware.settings.RATE_LIMIT_AUTH_PER_MINUTE", 7):
            rule = resolve_rate_limit("/api/auth/login-json", "POST")
        self.assertIsNotNone(rule)
        self.assertEqual(rule.scope, "auth")
        self.assertEqual(rule.requests, 7)

    def test_checkout_has_its_own_limit(self) -> None:
        rule = resolve_rate_limit("/api/public/catalog/demo-accesorios/checkout", "POST")
        self.assertIsNotNone(rule)
        self.assertEqual(rule.scope, "checkout")

    def test_private_routes_are_not_limited_by_public_rule(self) -> None:
        self.assertIsNone(resolve_rate_limit("/api/catalog/productos", "GET"))

    def test_sliding_window_rejects_and_recovers(self) -> None:
        limiter = SlidingWindowLimiter()
        rule = RateLimitRule("test", requests=2, window_seconds=60)
        self.assertEqual(limiter.allow("client", rule, now=0), (True, 0))
        self.assertEqual(limiter.allow("client", rule, now=1), (True, 0))
        allowed, retry_after = limiter.allow("client", rule, now=2)
        self.assertFalse(allowed)
        self.assertGreater(retry_after, 0)
        self.assertEqual(limiter.allow("client", rule, now=61), (True, 0))


if __name__ == "__main__":
    unittest.main()
