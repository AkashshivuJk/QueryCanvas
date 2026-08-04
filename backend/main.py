"""FastAPI application entry point for the QueryCanvas backend."""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import FRONTEND_DIST, get_host, get_port

from backend.routers import databases, export, history, query, recommendations


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        title="QueryCanvas API",
        version="1.0.0",
        description="Backend API for the QueryCanvas app.",
    )

    # CORS: allow all origins for local development.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routers.
    app.include_router(databases.router)
    app.include_router(query.router)
    app.include_router(history.router)
    app.include_router(recommendations.router)
    app.include_router(export.router)

    # Static frontend SPA serving.
    index_path = FRONTEND_DIST / "index.html"
    if FRONTEND_DIST.exists() and index_path.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(FRONTEND_DIST / "assets"))
            if (FRONTEND_DIST / "assets").exists()
            else StaticFiles(directory=str(FRONTEND_DIST)),
            name="assets",
        )

        @app.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            # Never shadow /api routes.
            if full_path.startswith("api"):
                from fastapi import HTTPException

                raise HTTPException(status_code=404, detail="Not found")
            candidate = FRONTEND_DIST / full_path
            if candidate.is_file():
                return FileResponse(str(candidate))
            return FileResponse(str(index_path))
    else:
        @app.get("/")
        async def root() -> dict:
            return {
                "name": "QueryCanvas API",
                "version": "1.0.0",
                "docs": "/docs",
                "status": "ok",
            }

    return app


app = create_app()


def main() -> None:
    """Run uvicorn directly when invoked as `python backend/main.py`."""
    import uvicorn

    host = get_host()
    port = get_port()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()