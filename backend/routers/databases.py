"""Database lifecycle, metadata, and rows router."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.db.manager import get_manager
from backend.models import CellEditRequest, DatabaseCreateRequest

router = APIRouter(prefix="/api", tags=["databases"])


def _manager():
    return get_manager()


# --- lifecycle --------------------------------------------------------------


@router.get("/databases")
def list_databases() -> list[dict[str, Any]]:
    return _manager().list()


@router.post("/databases")
def create_or_open_database(req: DatabaseCreateRequest) -> dict[str, Any]:
    if not req.path:
        raise HTTPException(status_code=400, detail="path is required")
    action = (req.action or "").lower()
    if action not in ("create", "open"):
        raise HTTPException(
            status_code=400, detail="action must be 'create' or 'open'"
        )
    mgr = _manager()
    try:
        if action == "create":
            return mgr.create(req.path)
        return mgr.open(req.path)
    except FileExistsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to {action} database: {e}")


@router.delete("/databases")
def close_database(path: str = Query(...)) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    closed = mgr.close(path)
    from backend.db.undo import remove_undo_manager

    remove_undo_manager(path)
    return {"success": closed, "path": path}


# --- metadata ---------------------------------------------------------------


@router.get("/databases/metadata")
def get_metadata(path: str = Query(...)) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    try:
        engine = mgr.get(path)
        return engine.metadata()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- rows -------------------------------------------------------------------


@router.get("/databases/tables/rows")
def get_rows(
    path: str = Query(...),
    table: str = Query(...),
    limit: int = Query(100, ge=0, le=1000),
    offset: int = Query(0, ge=0),
    sort: Optional[str] = Query(None),
    dir: str = Query("asc"),
    search: Optional[str] = Query(None),
) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    engine = mgr.get(path)
    try:
        return engine.rows(
            table=table,
            limit=limit,
            offset=offset,
            sort=sort,
            dir_=dir,
            search=search,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- cells ------------------------------------------------------------------


@router.post("/databases/cells")
def edit_cell(req: CellEditRequest) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(req.path):
        raise HTTPException(status_code=404, detail="Database not open")
    engine = mgr.get(req.path)
    try:
        affected = engine.update_cell(req.table, req.rowid, req.column, req.value)
        return {"success": affected > 0, "rowid": req.rowid, "affected": affected}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))