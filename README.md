# Mosaic

Mosaic is a private, web-first platform that lets small real-world groups create a temporary **Space** to share activity, messages, media, files, decisions, and preserve the memory of an event.

## Documentation

Detailed architectural and design specifications are located in the `docs/` directory:

- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) — Product requirements, MVP scope, and acceptance criteria.
- [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) — System architecture, data model, APIs, and WebRTC design.
- [`docs/UI_UX_SPEC.md`](docs/UI_UX_SPEC.md) — Interface guidelines, design tokens, component specs, and accessibility.
- [`docs/AGENTS.md`](docs/AGENTS.md) — Operating contract for contributors and AI coding agents.

---

## Monorepo Layout

```text
mosaic/
  apps/
    web/            # Next.js 14/15 + TypeScript + PWA client
    api/            # FastAPI + SQLAlchemy 2 + Alembic backend service
    worker/         # Python background worker for media/jobs
  packages/
    contracts/      # Generated TypeScript API & WebSocket contracts
    config/         # Shared TypeScript and lint configs
  infra/
    compose/        # Docker Compose (PostgreSQL, Redis, MinIO, coturn)
    coturn/         # STUN/TURN configuration
  docs/             # Core project specifications
  tests/
    e2e/            # Playwright end-to-end multi-browser test suite
```

---

## Local Development Setup

### 1. Prerequisites

- **Node.js**: >= 20.x (tested on v24.x)
- **Python**: >= 3.12 (tested on 3.14)
- **Docker & Docker Compose** (for PostgreSQL, Redis, MinIO, and coturn services)

### 2. Quickstart

#### Environment Configuration

```bash
cp .env.example .env
```

#### Infrastructure Services (Docker)

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

#### Backend API (FastAPI)

```bash
# Set up Python virtual environment
python -m venv .venv
# Activate virtual environment (Windows PowerShell: .venv\Scripts\Activate.ps1)
pip install -r apps/api/requirements.txt

# Run migrations
cd apps/api && alembic upgrade head && cd ../..

# Start API server
uvicorn apps.api.src.main:app --reload --port 8000
```

#### Frontend Web Client (Next.js)

```bash
npm install
npm run dev
```

The web client will be available at [http://localhost:3000](http://localhost:3000) and the API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Testing and Verification

```bash
# Run all tests
npm test

# Run API tests
pytest apps/api/tests

# Run Web tests
npm run test:web

# Typecheck all packages
npm run typecheck

# Code formatting check
npm run format:check
```

#### Terminal 1 — Backend API (FastAPI)

```bash

# From the project root (d:\mosaic)
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# (Optional) Run migrations if needed
alembic -c apps/api/alembic.ini upgrade head

# Start API server on port 8000
python -m uvicorn apps.api.src.main:app --reload --port 8000

# API URL: http://127.0.0.1:8000
# API Swagger Docs: http://127.0.0.1:8000/docs

```

#### Terminal 2 — Frontend Client (Next.js)

```bash
# From the project root (d:\mosaic)
npm run dev

# Web App URL: http://localhost:3000
```