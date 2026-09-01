import uuid
import logging
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("mosaic.api")


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            response.headers["X-Request-Id"] = request_id
            return response
        except StarletteHTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "code": f"http_{exc.status_code}",
                        "message": exc.detail,
                        "details": None,
                        "request_id": request_id,
                    }
                },
                headers={"X-Request-Id": request_id},
            )
        except Exception as exc:
            logger.exception(f"Unhandled error for request {request_id}: {exc}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "internal_server_error",
                        "message": "An unexpected server error occurred.",
                        "details": None,
                        "request_id": request_id,
                    }
                },
                headers={"X-Request-Id": request_id},
            )
