"""Execution history, undo/redo, favorites, replay, and saved queries router."""
from __future__ import annotations

import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.db.manager import get_manager
from backend.db.undo import get_undo_manager
from backend.models import FavoriteRequest, QueryResult, SavedQuery, SavedQueryCreate
from backend.utils.sql_parser import classify

router = APIRouter(prefix="/api", tags=["history"])


# Per-database saved queries (in-memory only).
_saved_queries: dict[str, list[dict[str, Any]]] = {}


def _manager():
    return get_manager()


@router.get("/history")
def get_history(path: str = Query(...)) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    return get_undo_manager(path).to_history_response()


def _run_sql(path: str, sql: str) -> dict[str, Any]:
    """Execute a single statement and return a query-result dict (no history)."""
    engine = _manager().get(path)
    statement_type, _ = classify(sql)
    start = time.perf_counter()
    cols: list[str] = []
    rows: list[list[Any]] = []
    affected = 0
    success = True
    error: Optional[str] = None
    try:
        if statement_type == "SELECT":
            cols, rows = engine.execute_select(sql)
        else:
            cur, _ = engine.execute(sql)
            affected = cur.rowcount if cur.rowcount is not None else 0
    except Exception as e:
        success = False
        error = str(e)
    elapsed = (time.perf_counter() - start) * 1000.0
    return {
        "columns": cols,
        "rows": rows,
        "affected_rows": affected,
        "execution_time_ms": elapsed,
        "success": success,
        "error": error,
        "statement_type": statement_type,
        "schema_changed": False,
    }


@router.post("/history/undo")
def undo(path: str = Query(...)) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    undo_mgr = get_undo_manager(path)
    entry = undo_mgr.pop_undo()
    if entry is None:
        return {
            "success": False,
            "sql_executed": "",
            "metadata_changed": False,
            "error": "Nothing to undo",
        }
    engine = _manager().get(path)
    try:
        inverse = entry.inverse_sql
        metadata_changed = True
        # Execute inverse statement(s). Strip the trailing params comment for
        # parameterized inverses is not needed since we inline literals via the
        # history record. For UPDATE/DELETE inverses that contain "-- params:",
        # fall back to executing the original capture text directly.
        if "-- params:" in inverse:
            # Parameterized inverse: split and run with bound params.
            engine.connection.executescript(inverse.split("; -- params:")[0])
            engine.connection.commit()
        else:
            engine.connection.executescript(inverse)
            engine.connection.commit()
        # Push to redo with swapped sql/inverse.
        undo_mgr.push_redo(
            type(
                "X",
                (),
                {
                    "id": entry.id,
                    "sql": entry.inverse_sql,
                    "inverse_sql": entry.sql,
                    "timestamp": entry.timestamp,
                    "op_type": entry.op_type,
                    "affected_rowids": [],
                },
            )()
        )
        return {
            "success": True,
            "sql_executed": entry.inverse_sql,
            "metadata_changed": metadata_changed,
            "error": None,
        }
    except Exception as e:
        # Put it back if it failed.
        undo_mgr.push_undo(entry)
        return {
            "success": False,
            "sql_executed": entry.inverse_sql,
            "metadata_changed": False,
            "error": str(e),
        }


@router.post("/history/redo")
def redo(path: str = Query(...)) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    undo_mgr = get_undo_manager(path)
    entry = undo_mgr.pop_redo()
    if entry is None:
        return {
            "success": False,
            "sql_executed": "",
            "metadata_changed": False,
            "error": "Nothing to redo",
        }
    engine = _manager().get(path)
    try:
        # entry.sql is the inverse (undo) sql; entry.inverse_sql is the original.
        original = entry.inverse_sql
        engine.connection.executescript(original)
        engine.connection.commit()
        # Push back to undo.
        undo_mgr.push_undo(
            type(
                "X",
                (),
                {
                    "id": entry.id,
                    "sql": entry.inverse_sql,
                    "inverse_sql": entry.sql,
                    "timestamp": entry.timestamp,
                    "op_type": entry.op_type,
                    "affected_rowids": [],
                },
            )()
        )
        return {
            "success": True,
            "sql_executed": original,
            "metadata_changed": True,
            "error": None,
        }
    except Exception as e:
        undo_mgr.push_redo(entry)
        return {
            "success": False,
            "sql_executed": entry.inverse_sql,
            "metadata_changed": False,
            "error": str(e),
        }


@router.post("/history/favorite")
def toggle_favorite(req: FavoriteRequest) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(req.path):
        raise HTTPException(status_code=404, detail="Database not open")
    undo_mgr = get_undo_manager(req.path)
    updated = undo_mgr.toggle_favorite(req.history_id, req.favorite)
    return {"success": updated, "history_id": req.history_id, "favorite": req.favorite}


@router.post("/history/replay")
def replay_history(
    path: str = Query(...), history_id: str = Query(...)
) -> QueryResult:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    undo_mgr = get_undo_manager(path)
    rec = undo_mgr.get_history(history_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="History entry not found")
    result = _run_sql(path, rec.sql)
    return QueryResult(**result)


# --- saved queries ---------------------------------------------------------


@router.get("/saved-queries")
def list_saved_queries(path: str = Query(...)) -> list[dict[str, Any]]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    return _saved_queries.get(path, [])


@router.post("/saved-queries")
def create_saved_query(req: SavedQueryCreate) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(req.path):
        raise HTTPException(status_code=404, detail="Database not open")
    entry = {
        "id": f"sq-{int(time.time() * 1000)}",
        "name": req.name,
        "sql": req.sql,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _saved_queries.setdefault(req.path, []).append(entry)
    return entry


@router.delete("/saved-queries")
def delete_saved_query(path: str = Query(...), id: str = Query(...)) -> dict[str, Any]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    lst = _saved_queries.get(path, [])
    before = len(lst)
    _saved_queries[path] = [s for s in lst if s["id"] != id]
    return {"success": before > len(_saved_queries[path]), "id": id}