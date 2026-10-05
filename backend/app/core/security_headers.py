"""Security response headers.

ASGI middleware that adds a fixed set of response headers. Applied in
`app.main` after CORS, so it runs outermost and therefore also stamps the
preflight responses CORS generates.

Verified absent on the current production deployment before this change
(`https://codeatlas-qr0e.onrender.com/docs` returned no CSP, no
X-Content-Type-Options, no Referrer-Policy and no HSTS).

Content-Security-Policy is deliberately NOT `frame-ancestors`-only: the API is a
JSON service and nothing renders HTML from it, so a strict `default-src 'none'`
is both safer and cheaper than an allowlist that has to be maintained. Swagger
UI is the one exception -- it needs inline script and style from a CDN -- so it
is served with its own relaxed policy rather than weakening every other route.

Docs: docs/audit/01-code-audit.md finding H6.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Applied to every response.
#
# `object-src 'none'` plus `frame-ancestors 'none'` blocks clickjacking without
# needing X-Frame-Options, but the header is still sent because some corporate
# proxies and older browsers only read X-Frame-Options.
_COMMON: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        # A JSON API should never need to load or execute anything. The one
        # carve-out is that FastAPI's WebSocket upgrade is unaffected by CSP, so
        # the realtime gateway keeps working under this policy.
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    ),
}

# Swagger UI and ReDoc are the only routes that serve HTML with its own inline
# assets, so they get the minimum needed to render and nothing more.
_DOCS_CSP = (
    "default-src 'none'; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "font-src 'self' https://cdn.jsdelivr.net; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)

# Served only over HTTPS. HSTS is only sent when the request itself was HTTPS,
# so a local http://dev run does not pin the browser to a dead origin.
_HSTS = "max-age=31536000; includeSubDomains"

_DOC_PATHS = ("/docs", "/redoc", "/docs/oauth2-redirect")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add defensive response headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        response: Response = await call_next(request)

        for header, value in _COMMON.items():
            response.headers.setdefault(header, value)

        if request.url.path in _DOC_PATHS or request.url.path == "/openapi.json":
            # These routes genuinely need script/style/connect sources.
            response.headers["Content-Security-Policy"] = _DOCS_CSP

        if (
            request.url.scheme == "https"
            or request.headers.get("x-forwarded-proto") == "https"
        ):
            response.headers.setdefault("Strict-Transport-Security", _HSTS)

        return response
