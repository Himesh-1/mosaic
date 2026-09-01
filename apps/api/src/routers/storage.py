import mimetypes
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse

router = APIRouter(prefix="/storage", tags=["Local Storage"])

LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[4] / ".storage"
LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


@router.put("/upload/{storage_key:path}")
async def upload_local_file(storage_key: str, request: Request):
    """
    Local filesystem upload fallback when MinIO/S3 is not running locally.
    Accepts raw binary body streams and writes to local disk.
    """
    clean_key = storage_key.strip("/\\")
    if not clean_key or ".." in clean_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage key.")

    target_path = LOCAL_STORAGE_DIR / clean_key
    target_path.parent.mkdir(parents=True, exist_ok=True)

    body = await request.body()
    with open(target_path, "wb") as f:
        f.write(body)

    return {
        "status": "ok",
        "storage_key": clean_key,
        "bytes_written": len(body),
    }


@router.get("/download/{storage_key:path}")
async def download_local_file(storage_key: str, filename: Optional[str] = None):
    """
    Local filesystem download/view fallback when MinIO/S3 is not running locally.
    """
    clean_key = storage_key.strip("/\\")
    if not clean_key or ".." in clean_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage key.")

    target_path = LOCAL_STORAGE_DIR / clean_key
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in local storage.")

    effective_name = filename or target_path.name
    guessed_type, _ = mimetypes.guess_type(effective_name)

    return FileResponse(
        path=str(target_path),
        media_type=guessed_type or "application/octet-stream",
        filename=effective_name,
    )
