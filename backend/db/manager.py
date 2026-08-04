"""DatabaseManager: registry of open database engines."""
from __future__ import annotations

import os
from typing import Optional

from .engine import DatabaseEngineBase, SQLiteEngine, db_size, get_engine


class DatabaseManager:
    """In-memory registry of open databases keyed by absolute path."""

    def __init__(self) -> None:
        self._engines: dict[str, DatabaseEngineBase] = {}

    # --- helpers -------------------------------------------------------------

    def _normalize(self, path: str) -> str:
        return os.path.abspath(path)

    def _name_from_path(self, path: str) -> str:
        base = os.path.basename(path)
        if base.endswith(".db"):
            return base[:-3]
        return base

    # --- registry -------------------------------------------------------------

    def create(self, path: str, backend: str = "sqlite") -> dict:
        """Create a new database file and open it. Fails if file exists."""
        npath = self._normalize(path)
        if os.path.exists(npath):
            raise FileExistsError(f"Database already exists: {npath}")
        # Ensure parent dir exists.
        parent = os.path.dirname(npath)
        if parent and not os.path.isdir(parent):
            os.makedirs(parent, exist_ok=True)
        # Touch the file so the engine can open it.
        open(npath, "a").close()
        engine = get_engine(backend, npath)
        self._engines[npath] = engine
        return self._info(npath)

    def open(self, path: str, backend: str = "sqlite") -> dict:
        """Open an existing database file. Fails if file does not exist."""
        npath = self._normalize(path)
        if not os.path.exists(npath):
            raise FileNotFoundError(f"Database file not found: {npath}")
        if npath in self._engines:
            return self._info(npath)
        engine = get_engine(backend, npath)
        self._engines[npath] = engine
        return self._info(npath)

    def close(self, path: str) -> bool:
        npath = self._normalize(path)
        engine = self._engines.pop(npath, None)
        if engine is None:
            return False
        engine.close()
        return True

    def get(self, path: str) -> DatabaseEngineBase:
        npath = self._normalize(path)
        engine = self._engines.get(npath)
        if engine is None:
            raise KeyError(f"Database not open: {npath}")
        return engine

    def contains(self, path: str) -> bool:
        return self._normalize(path) in self._engines

    def list(self) -> list[dict]:
        return [self._info(p) for p in self._engines]

    def _info(self, path: str) -> dict:
        return {
            "path": path,
            "name": self._name_from_path(path),
            "size_bytes": db_size(path),
            "backend": "sqlite",
        }


# Shared singleton instance.
_manager: Optional[DatabaseManager] = None


def get_manager() -> DatabaseManager:
    global _manager
    if _manager is None:
        _manager = DatabaseManager()
    return _manager