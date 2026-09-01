import json
from pathlib import Path
from fastapi.openapi.utils import get_openapi
from apps.api.src.main import app


def export_openapi() -> None:
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    contracts_dir = Path("packages/contracts")
    contracts_dir.mkdir(parents=True, exist_ok=True)
    out_file = contracts_dir / "openapi.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)
    print(f"Exported OpenAPI schema to {out_file}")


if __name__ == "__main__":
    export_openapi()
