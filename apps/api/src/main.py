import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from apps.api.src.config import get_settings
from apps.api.src.database import Base, engine
from apps.api.src.middleware.request_id import RequestIdMiddleware
from apps.worker.main import run_worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mosaic.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized.")

    # Start background worker task
    worker_task = asyncio.create_task(run_worker())

    yield

    logger.info("Shutting down API service...")
    worker_task.cancel()
    try:
        await worker_task
    except (asyncio.CancelledError, Exception) as exc:
        logger.debug(f"Worker task terminated: {exc}")

    await engine.dispose()



app = FastAPI(
    title="Mosaic API",
    description="Backend API service for Mosaic temporary digital spaces",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Request ID & Error formatting middleware
app.add_middleware(RequestIdMiddleware)

from apps.api.src.middleware.security import SecurityHeadersMiddleware, RateLimiterMiddleware

# Security Headers & Rate Limiting
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimiterMiddleware, max_requests=60, window_seconds=60)

# CORS configuration
origins = [
    settings.APP_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)


from starlette.exceptions import HTTPException as StarletteHTTPException
from apps.api.src.routers.health import router as health_router
from apps.api.src.routers.auth import router as auth_router, get_me
from apps.api.src.routers.spaces import router as spaces_router
from apps.api.src.routers.invites import router as invites_router
from apps.api.src.routers.activity import router as activity_router
from apps.api.src.routers.realtime import router as realtime_router
from apps.api.src.routers.artifacts import router as artifacts_router
from apps.api.src.routers.uploads import router as uploads_router
from apps.api.src.routers.transfers import router as transfers_router
from apps.api.src.routers.storage import router as storage_router
from apps.api.src.schemas.auth import MeResponse


# Exception Handlers ensuring standardized error envelope
@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"http_{exc.status_code}",
                "message": str(exc.detail),
                "details": None,
                "request_id": request_id,
            }
        },
        headers={"X-Request-Id": request_id} if request_id else {},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"http_{exc.status_code}",
                "message": str(exc.detail),
                "details": None,
                "request_id": request_id,
            }
        },
        headers={"X-Request-Id": request_id} if request_id else {},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "error": {
                "code": "validation_error",
                "message": "Invalid request payload.",
                "details": exc.errors(),
                "request_id": request_id,
            }
        },
        headers={"X-Request-Id": request_id} if request_id else {},
    )


# Mount routers under /api/v1
api_v1_prefix = settings.API_V1_PREFIX
app.include_router(health_router, prefix=api_v1_prefix)
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(spaces_router, prefix=api_v1_prefix)
app.include_router(invites_router, prefix=api_v1_prefix)
app.include_router(activity_router, prefix=api_v1_prefix)
app.include_router(realtime_router, prefix=api_v1_prefix)
app.include_router(artifacts_router, prefix=api_v1_prefix)
app.include_router(uploads_router, prefix=api_v1_prefix)
app.include_router(transfers_router, prefix=api_v1_prefix)
app.include_router(storage_router, prefix=api_v1_prefix)
app.add_api_route(f"{api_v1_prefix}/me", get_me, methods=["GET"], response_model=MeResponse, tags=["Auth"])



@app.get("/")
async def root() -> dict:
    return {
        "name": "Mosaic API",
        "version": "0.1.0",
        "docs": "/docs",
        "api_v1": api_v1_prefix,
    }
