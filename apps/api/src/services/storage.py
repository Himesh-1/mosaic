import logging
import socket
import urllib.parse
from typing import Dict, Any, Optional
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from apps.api.src.config import get_settings

logger = logging.getLogger("mosaic.storage")
settings = get_settings()


class StorageService:
    def __init__(self):
        self.bucket = settings.OBJECT_STORAGE_BUCKET
        self._client = None

    def is_s3_available(self) -> bool:
        """Checks if configured S3/MinIO endpoint is reachable."""
        try:
            parsed = urllib.parse.urlparse(settings.OBJECT_STORAGE_ENDPOINT)
            host = parsed.hostname or "localhost"
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            with socket.create_connection((host, port), timeout=0.3):
                return True
        except Exception:
            return False

    def get_client(self):
        if not self.is_s3_available():
            return None
        if self._client is None:
            try:
                self._client = boto3.client(
                    "s3",
                    endpoint_url=settings.OBJECT_STORAGE_ENDPOINT,
                    aws_access_key_id=settings.OBJECT_STORAGE_ACCESS_KEY,
                    aws_secret_access_key=settings.OBJECT_STORAGE_SECRET_KEY,
                    region_name=settings.OBJECT_STORAGE_REGION,
                    use_ssl=settings.OBJECT_STORAGE_USE_SSL,
                    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
                )
            except Exception as exc:
                logger.warning(f"S3 client init failed: {exc}")
                self._client = None
        return self._client

    def generate_presigned_upload_url(
        self,
        storage_key: str,
        mime_type: str,
        expires_in_seconds: int = 900,
    ) -> Dict[str, Any]:
        """Generates an upload URL (S3 presigned PUT or local backend storage fallback)."""
        client = self.get_client()
        if client:
            try:
                url = client.generate_presigned_url(
                    ClientMethod="put_object",
                    Params={
                        "Bucket": self.bucket,
                        "Key": storage_key,
                        "ContentType": mime_type,
                    },
                    ExpiresIn=expires_in_seconds,
                )
                return {
                    "upload_url": url,
                    "method": "PUT",
                    "headers": {"Content-Type": mime_type},
                    "expires_in_seconds": expires_in_seconds,
                }
            except Exception as exc:
                logger.warning(f"Error generating presigned PUT: {exc}")

        # Local storage fallback endpoint on FastAPI backend
        local_url = f"{settings.API_ORIGIN}/api/v1/storage/upload/{storage_key}"
        return {
            "upload_url": local_url,
            "method": "PUT",
            "headers": {"Content-Type": mime_type},
            "expires_in_seconds": expires_in_seconds,
        }

    def generate_presigned_download_url(
        self,
        storage_key: str,
        original_name: Optional[str] = None,
        expires_in_seconds: int = 900,
    ) -> str:
        """Generates a private download URL (S3 presigned GET or local backend storage fallback)."""
        client = self.get_client()
        if client:
            try:
                params: Dict[str, Any] = {
                    "Bucket": self.bucket,
                    "Key": storage_key,
                }
                if original_name:
                    params["ResponseContentDisposition"] = f'inline; filename="{original_name}"'

                return client.generate_presigned_url(
                    ClientMethod="get_object",
                    Params=params,
                    ExpiresIn=expires_in_seconds,
                )
            except Exception as exc:
                logger.warning(f"Error generating presigned GET: {exc}")

        # Local storage fallback endpoint on FastAPI backend
        encoded_name = urllib.parse.quote(original_name) if original_name else ""
        query = f"?filename={encoded_name}" if encoded_name else ""
        return f"{settings.API_ORIGIN}/api/v1/storage/download/{storage_key}{query}"


storage_service = StorageService()
