import time
from collections import defaultdict
from typing import Dict, List, ClassVar
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding-window rate limiter for sensitive authentication and join routes.
    Limits clients (by IP) to max_requests requests per window_seconds on sensitive endpoints.
    """

    _instances: ClassVar[List["RateLimiterMiddleware"]] = []

    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)
        RateLimiterMiddleware._instances.append(self)

    @classmethod
    def reset_all(cls):
        for inst in cls._instances:
            inst.requests.clear()

    def _is_rate_limited_route(self, path: str) -> bool:
        sensitive_prefixes = [
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/guest",
            "/api/v1/invites/",
        ]
        return any(path.startswith(prefix) for prefix in sensitive_prefixes)

    async def dispatch(self, request: Request, call_next):
        if not self._is_rate_limited_route(request.url.path):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old timestamps
        history = [ts for ts in self.requests[client_ip] if ts > window_start]
        self.requests[client_ip] = history

        if len(history) >= self.max_requests:
            request_id = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": {
                        "code": "rate_limit_exceeded",
                        "message": "Too many requests. Please wait a moment before trying again.",
                        "details": {"window_seconds": self.window_seconds, "max_requests": self.max_requests},
                        "request_id": request_id,
                    }
                },
                headers={"Retry-After": str(self.window_seconds)},
            )

        self.requests[client_ip].append(now)
        return await call_next(request)
