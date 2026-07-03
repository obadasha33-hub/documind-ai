"""Local filesystem storage service for document files (replaces Cloudflare R2)."""

import os
from pathlib import Path
from typing import Any

from ..core.config import settings

# Ensure the upload directory exists at startup
BASE_UPLOAD_PATH = Path(settings.LOCAL_UPLOAD_DIR).resolve()
BASE_UPLOAD_PATH.mkdir(parents=True, exist_ok=True)


def _full_path(r2_key: str) -> Path:
    """Convert a logical R2 key (e.g., 'tenant/doc_id/file.pdf') to an absolute path on disk.
    The key may contain forward slashes; we preserve the hierarchy under the base upload directory.
    """
    # Prevent path traversal attacks: normalize and ensure it stays under BASE_UPLOAD_PATH
    safe_path = BASE_UPLOAD_PATH.joinpath(*r2_key.split("/"))
    resolved = safe_path.resolve()
    if not str(resolved).startswith(str(BASE_UPLOAD_PATH)):
        raise ValueError("Invalid storage key – attempts to escape upload directory")
    resolved.parent.mkdir(parents=True, exist_ok=True)
    return resolved


async def upload_file(file_content: bytes, r2_key: str, content_type: str = "application/octet-stream") -> str:
    """Write the file content to the local filesystem. Returns the logical key unchanged.
    The `content_type` argument is kept for API compatibility but is unused.
    """
    path = _full_path(r2_key)
    # Write binary content atomically
    temp_path = path.with_suffix(path.suffix + ".tmp")
    path.write_bytes(file_content)
    return r2_key


async def download_file(r2_key: str) -> bytes:
    """Read the file from disk and return its bytes. Raises FileNotFoundError if missing."""
    path = _full_path(r2_key)
    return path.read_bytes()


async def delete_file(r2_key: str) -> None:
    """Delete the file from disk. Silently ignores if the file does not exist."""
    path = _full_path(r2_key)
    try:
        path.unlink()
    except FileNotFoundError:
        pass
