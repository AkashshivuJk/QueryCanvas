"""Export router: json, sql, svg, png, pdf."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from backend.db.manager import get_manager
from backend.utils.export import (
    export_json,
    export_pdf,
    export_png,
    export_sql,
    export_svg,
)

router = APIRouter(prefix="/api", tags=["export"])


def _manager():
    return get_manager()


@router.get("/export")
def export_database(path: str = Query(...), format: str = Query("json")) -> Response:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    engine = mgr.get(path)
    fmt = (format or "").lower()

    if fmt == "json":
        metadata = engine.metadata()
        return Response(
            content=export_json(metadata),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="schema.json"'},
        )
    if fmt == "sql":
        schema_sql = engine.get_schema_sql()
        data_dump = engine.get_data_dump()
        return Response(
            content=export_sql(schema_sql, data_dump),
            media_type="application/sql",
            headers={"Content-Disposition": 'attachment; filename="schema.sql"'},
        )
    if fmt == "svg":
        metadata = engine.metadata()
        return Response(
            content=export_svg(metadata),
            media_type="image/svg+xml",
            headers={"Content-Disposition": 'attachment; filename="schema.svg"'},
        )
    if fmt == "png":
        metadata = engine.metadata()
        return Response(
            content=export_png(metadata),
            media_type="image/png",
            headers={"Content-Disposition": 'attachment; filename="schema.png"'},
        )
    if fmt == "pdf":
        metadata = engine.metadata()
        return Response(
            content=export_pdf(metadata),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="schema.pdf"'},
        )
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported export format: {format!r}. Use json, sql, svg, png, or pdf.",
    )