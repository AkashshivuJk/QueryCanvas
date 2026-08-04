"""Query execution and explain router."""
from __future__ import annotations

import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.db.manager import get_manager
from backend.db.undo import get_undo_manager
from backend.models import ExplainResult, MultiQueryResult, QueryRequest, QueryResult
from backend.services.explainer import explain as explain_plan
from backend.utils.sql_parser import (
    classify,
    generate_inverse,
    inverse_for_insert,
    split_statements,
)

router = APIRouter(prefix="/api", tags=["query"])


def _manager():
    return get_manager()


def _execute_with_tracking(path: str, sql: str) -> dict[str, Any]:
    """Execute a statement, record history, and handle undo capture."""
    engine = _manager().get(path)
    undo_mgr = get_undo_manager(path)
    statement_type, schema_changed = classify(sql)
    start = time.perf_counter()
    error: Optional[str] = None
    cols: list[str] = []
    rows: list[list[Any]] = []
    affected = 0
    success = True
    inverse_sql = ""
    op_type = "UNKNOWN"

    # Capture inverse BEFORE executing for DROP/UPDATE/DELETE/ALTER.
    if schema_changed:
        try:
            op_type, inverse_sql = generate_inverse(engine.connection, sql)
        except Exception:
            op_type, inverse_sql = "UNKNOWN", ""

    try:
        if statement_type == "SELECT":
            cols, rows = engine.execute_select(sql)
        else:
            cur, _ = engine.execute(sql)
            affected = cur.rowcount if cur.rowcount is not None else 0
            # For INSERT, capture rowid-based inverse after execute.
            if op_type == "INSERT":
                inverse_sql = inverse_for_insert(engine.connection, sql)
    except Exception as e:
        success = False
        error = str(e)

    elapsed_ms = (time.perf_counter() - start) * 1000.0

    # Record execution history.
    undo_mgr.add_history(
        sql=sql,
        execution_time_ms=elapsed_ms,
        affected_rows=affected,
        success=success,
        error=error,
        statement_type=statement_type,
    )

    # Push undo entry only if schema changed and execution succeeded.
    if schema_changed and success:
        undo_mgr.capture_undo(engine.connection, sql, op_type, inverse_sql)

    return {
        "columns": cols,
        "rows": rows,
        "affected_rows": affected,
        "execution_time_ms": elapsed_ms,
        "success": success,
        "error": error,
        "statement_type": statement_type,
        "schema_changed": schema_changed,
    }


@router.post("/query")
def execute_query(req: QueryRequest) -> MultiQueryResult:
    mgr = _manager()
    if not mgr.contains(req.path):
        raise HTTPException(status_code=404, detail="Database not open")
    try:
        statements = split_statements(req.sql)
        if not statements:
            return MultiQueryResult(
                results=[
                    QueryResult(
                        columns=[],
                        rows=[],
                        affected_rows=0,
                        execution_time_ms=0,
                        success=False,
                        error="No valid SQL statements",
                        statement_type="UNKNOWN",
                        schema_changed=False,
                    )
                ],
                total=1,
                any_schema_changed=False,
            )
        results: list[dict[str, Any]] = []
        for stmt in statements:
            results.append(_execute_with_tracking(req.path, stmt))
        any_schema_changed = any(r["schema_changed"] for r in results)
        return MultiQueryResult(
            results=[QueryResult(**r) for r in results],
            total=len(results),
            any_schema_changed=any_schema_changed,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))




@router.post("/explain")
def explain_query(req: QueryRequest) -> ExplainResult:
    mgr = _manager()
    if not mgr.contains(req.path):
        raise HTTPException(status_code=404, detail="Database not open")
    engine = mgr.get(req.path)
    try:
        plan_rows = engine.explain(req.sql)
        result = explain_plan(plan_rows, req.sql)
        return ExplainResult(**result)
    except Exception as e:
        # Return a failing-but-200 response for user SQL errors.
        return ExplainResult(
            plan=[],
            estimated_cost=0,
            indexes_used=[],
            suggestions=[],
            potential_problems=[],
        )