"""Tests for security headers and HTTP rate limiting.

Both are response-surface behaviour that a 200-status smoke test cannot catch,
so they are asserted on headers and status codes directly.

Audit: docs/audit/01-code-audit.md findings H6, H7.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import MAX_TRACKED_KEYS, SlidingWindowLimiter, reset_limiters
from app.core.security_headers import _COMMON


@pytest.fixture(autouse=True)
def _clean_limiters():
    """Rate-limit counters are module-global; isolate each test from the last."""
    reset_limiters()
    yield
    reset_limiters()


class TestSecurityHeaders:
    def test_api_responses_carry_the_defensive_headers(
        self, client: TestClient
    ) -> None:
        response = client.get("/repos")
        # 401 rather than 200 -- auth still runs first, but the point is that a
        # rejected request is still hardened.
        assert response.status_code == 401
        for header, value in _COMMON.items():
            assert response.headers[header] == value, f"missing {header}"

    def test_csp_blocks_scripts_and_framing(self, client: TestClient) -> None:
        csp = client.get("/repos").headers["Content-Security-Policy"]
        assert "default-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp

    def test_docs_get_a_relaxed_csp_because_they_render_html(
        self, client: TestClient
    ) -> None:
        """Swagger UI needs inline script and a CDN; the API must not."""
        response = client.get("/docs")
        assert response.status_code == 200
        csp = response.headers["Content-Security-Policy"]
        assert csp != _COMMON["Content-Security-Policy"]
        assert "cdn.jsdelivr.net" in csp
        # Even the relaxed policy must not allow framing or base-tag injection.
        assert "frame-ancestors 'none'" in csp
        assert "base-uri 'none'" in csp

    def test_openapi_json_also_gets_the_docs_csp(self, client: TestClient) -> None:
        response = client.get("/openapi.json")
        assert response.status_code == 200
        assert "cdn.jsdelivr.net" in response.headers["Content-Security-Policy"]

    def test_hsts_is_absent_over_plain_http(self, client: TestClient) -> None:
        """Pinning a dev origin to HTTPS would break local development."""
        assert "Strict-Transport-Security" not in client.get("/repos").headers

    def test_hsts_is_sent_when_forwarded_as_https(self, client: TestClient) -> None:
        """Render terminates TLS in front of the app and sets this header."""
        response = client.get("/repos", headers={"X-Forwarded-Proto": "https"})
        assert "max-age=31536000" in response.headers["Strict-Transport-Security"]


class TestSlidingWindowLimiter:
    def test_allows_up_to_the_limit_then_blocks(self) -> None:
        limiter = SlidingWindowLimiter(limit=3, window_seconds=60)
        assert [limiter.hit("k") for _ in range(4)] == [True, True, True, False]

    def test_window_resets(self) -> None:
        limiter = SlidingWindowLimiter(limit=2, window_seconds=10)
        assert limiter.hit("k", now=0.0)
        assert limiter.hit("k", now=1.0)
        assert limiter.hit("k", now=2.0) is False
        # Past the window the budget is restored.
        assert limiter.hit("k", now=11.0) is True

    def test_keys_have_independent_budgets(self) -> None:
        limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
        assert limiter.hit("a") is True
        assert limiter.hit("b") is True
        assert limiter.hit("a") is False

    def test_retry_after_is_at_least_one_second(self) -> None:
        limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
        limiter.hit("k", now=0.0)
        limiter.hit("k", now=0.0)
        assert limiter.retry_after("k", now=0.5) >= 1

    def test_retry_after_for_unknown_key_is_zero(self) -> None:
        assert SlidingWindowLimiter(1, 60).retry_after("never-seen") == 0

    def test_memory_is_bounded(self) -> None:
        """A rotating-IP flood must not grow the map without bound."""
        limiter = SlidingWindowLimiter(limit=100, window_seconds=60)
        for i in range(MAX_TRACKED_KEYS + 500):
            limiter.hit(f"ip:{i}")
        assert len(limiter._buckets) <= MAX_TRACKED_KEYS

    def test_reset_clears_counters(self) -> None:
        limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
        limiter.hit("k")
        assert limiter.hit("k") is False
        limiter.reset()
        assert limiter.hit("k") is True


class TestRateLimitMiddleware:
    def test_login_endpoint_is_capped(self, client: TestClient) -> None:
        """20/min is the configured budget for /auth/github/login."""
        statuses = [client.get("/auth/github/login").status_code for _ in range(22)]
        # Exactly 20 pass, then the limiter engages.
        assert statuses[:20] == [200] * 20
        assert statuses[20] == 429

    def test_429_includes_retry_after(self, client: TestClient) -> None:
        for _ in range(25):
            response = client.get("/auth/github/login")
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1
        assert "Rate limit exceeded" in response.json()["detail"]

    def test_limits_are_per_client_not_global(self, client: TestClient) -> None:
        """One caller exhausting its budget must not affect another."""
        for _ in range(25):
            client.get("/auth/github/login", headers={"X-Forwarded-For": "1.1.1.1"})
        blocked = client.get(
            "/auth/github/login", headers={"X-Forwarded-For": "1.1.1.1"}
        )
        fresh = client.get("/auth/github/login", headers={"X-Forwarded-For": "2.2.2.2"})
        assert blocked.status_code == 429
        assert fresh.status_code != 429

    def test_authenticated_callers_are_keyed_separately(
        self, client: TestClient
    ) -> None:
        """Bearer tokens key by user, so one user cannot spend another's budget.

        The /repos budget is 30/min. The token is a bogus one on purpose -- the
        limiter runs before auth, so these are 403s until the budget runs out and
        the 429 proves the budget was tracked per token, not per process.
        """
        headers_a = {"Authorization": "Bearer user-a-token"}
        headers_b = {"Authorization": "Bearer user-b-token"}

        for _ in range(32):
            client.get("/repos", headers=headers_a)

        a = client.get("/repos", headers=headers_a)
        b = client.get("/repos", headers=headers_b)

        assert a.status_code == 429
        assert b.status_code == 403, "user-b must not inherit user-a's exhaustion"

    def test_docs_and_schema_are_not_rate_limited(self, client: TestClient) -> None:
        """Non-API routes must stay reachable for debugging."""
        for _ in range(30):
            assert client.get("/docs").status_code == 200
            assert client.get("/openapi.json").status_code == 200

    def test_openapi_route_listing_is_untouched(self, client: TestClient) -> None:
        for _ in range(30):
            assert client.get("/openapi.json").status_code == 200
