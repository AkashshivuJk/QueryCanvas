"""Application configuration and path helpers."""
from __future__ import annotations

import os
from pathlib import Path

# Root of the backend package.
BACKEND_DIR: Path = Path(__file__).resolve().parent

# Project root (parent of backend/).
PROJECT_ROOT: Path = BACKEND_DIR.parent

# Optional static frontend build directory.
FRONTEND_DIST: Path = PROJECT_ROOT / "frontend" / "dist"


def get_port() -> int:
    """Return the port to run uvicorn on, from PORT env (default 8000)."""
    raw = os.environ.get("PORT")
    if not raw:
        return 8000
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 8000


def get_host() -> str:
    """Return the host to bind, from HOST env (default 127.0.0.1)."""
    return os.environ.get("HOST", "127.0.0.1")