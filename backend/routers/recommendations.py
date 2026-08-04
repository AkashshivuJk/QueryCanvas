"""Recommendations router."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.db.manager import get_manager
from backend.services.recommender import generate_recommendations

router = APIRouter(prefix="/api", tags=["recommendations"])


def _manager():
    return get_manager()


@router.get("/recommendations")
def get_recommendations(path: str = Query(...)) -> list[dict]:
    mgr = _manager()
    if not mgr.contains(path):
        raise HTTPException(status_code=404, detail="Database not open")
    engine = mgr.get(path)
    try:
        metadata = engine.metadata()
        return generate_recommendations(metadata)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))