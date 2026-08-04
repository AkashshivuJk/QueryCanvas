"""End-to-end smoke test exercising the API via FastAPI TestClient.

Run with: python3 backend/smoke_test.py
Uses a temporary SQLite file and verifies all major endpoints.
"""
from __future__ import annotations

import os
import sys
import tempfile

# Ensure the project root is importable when running as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from backend.db.manager import get_manager  # noqa: E402
from backend.main import app  # noqa: E402


def _check(label: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {label}" + (f" :: {detail}" if detail else ""))
    if not condition:
        raise AssertionError(f"Smoke test failed at: {label} {detail}")


def main() -> None:
    client = TestClient(app)

    tmpdir = tempfile.mkdtemp(prefix="dvws_smoke_")
    db_path = os.path.join(tmpdir, "smoke.db")

    # 1. Create database.
    r = client.post("/api/databases", json={"path": db_path, "action": "create"})
    _check("POST /databases create", r.status_code == 200, str(r.status_code))
    info = r.json()
    _check("db path matches", info["path"] == os.path.abspath(db_path))
    _check("db backend sqlite", info["backend"] == "sqlite")

    # Duplicate create -> 400.
    r2 = client.post("/api/databases", json={"path": db_path, "action": "create"})
    _check("duplicate create rejected", r2.status_code == 400)

    # 2. List databases.
    r = client.get("/api/databases")
    _check("GET /databases", r.status_code == 200)
    _check("db in list", any(d["path"] == os.path.abspath(db_path) for d in r.json()))

    # 3. Create table + insert.
    enc_path = os.path.abspath(db_path)
    r = client.post("/api/query", json={"path": enc_path, "sql": "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER);"})
    _check("CREATE TABLE", r.json()["success"] is True and r.json()["schema_changed"] is True, str(r.json()))

    r = client.post("/api/query", json={"path": enc_path, "sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, FOREIGN KEY(user_id) REFERENCES users(id));"})
    _check("CREATE TABLE posts", r.json()["success"] is True, str(r.json()))

    r = client.post("/api/query", json={"path": enc_path, "sql": "INSERT INTO users (name, email, age) VALUES ('Alice','alice@x.com',30),('Bob','bob@x.com',25),('Alice','alice2@x.com',30);"})
    _check("INSERT users", r.json()["success"] is True and r.json()["affected_rows"] == 3, str(r.json()))

    # 4. Metadata.
    r = client.get("/api/databases/metadata", params={"path": enc_path})
    _check("GET metadata", r.status_code == 200)
    meta = r.json()
    tables = meta["schemas"][0]["tables"]
    table_names = [t["name"] for t in tables]
    _check("users table in metadata", "users" in table_names)
    users_t = next(t for t in tables if t["name"] == "users")
    _check("users row_count==3", users_t["row_count"] == 3, str(users_t["row_count"]))
    _check("users has pk col", any(c["is_pk"] for c in users_t["columns"]))
    posts_t = next(t for t in tables if t["name"] == "posts")
    _check("posts has fk", len(posts_t["foreign_keys"]) == 1, str(posts_t["foreign_keys"]))

    # 5. Query (SELECT).
    r = client.post("/api/query", json={"path": enc_path, "sql": "SELECT name, age FROM users WHERE age > 26;"})
    _check("SELECT query", r.json()["success"] is True, str(r.json()))
    _check("SELECT columns", r.json()["columns"] == ["name", "age"], str(r.json()["columns"]))
    _check("SELECT rows count", len(r.json()["rows"]) == 2, str(r.json()["rows"]))

    # 6. Rows endpoint.
    r = client.get("/api/databases/tables/rows", params={"path": enc_path, "table": "users", "limit": 10})
    _check("GET rows", r.status_code == 200)
    _check("rows total==3", r.json()["total"] == 3, str(r.json()))

    # 7. Cell edit.
    r = client.post("/api/databases/cells", json={"path": enc_path, "table": "users", "rowid": 1, "column": "age", "value": 31})
    _check("cell edit", r.json()["success"] is True, str(r.json()))

    # 8. Single-row insert + undo/redo.
    r = client.post("/api/query", json={"path": enc_path, "sql": "INSERT INTO users (name, email, age) VALUES ('Carol','carol@x.com',40);"})
    _check("INSERT carol", r.json()["success"] is True, str(r.json()))
    r = client.post("/api/query", json={"path": enc_path, "sql": "SELECT COUNT(*) FROM users;"})
    _check("count 4 before undo", r.json()["rows"][0][0] == 4, str(r.json()))

    r = client.post("/api/history/undo", params={"path": enc_path})
    _check("undo insert", r.json()["success"] is True, str(r.json()))
    r = client.post("/api/query", json={"path": enc_path, "sql": "SELECT COUNT(*) FROM users;"})
    _check("count back to 3 after undo", r.json()["rows"][0][0] == 3, str(r.json()))

    r = client.post("/api/history/redo", params={"path": enc_path})
    _check("redo insert", r.json()["success"] is True, str(r.json()))
    r = client.post("/api/query", json={"path": enc_path, "sql": "SELECT COUNT(*) FROM users;"})
    _check("count 4 after redo", r.json()["rows"][0][0] == 4, str(r.json()))

    # 9. Undo a CREATE TABLE (posts) — pop carol, multi-insert, then CREATE posts.
    client.post("/api/history/undo", params={"path": enc_path})  # undo carol
    client.post("/api/history/undo", params={"path": enc_path})  # undo multi-insert
    r = client.post("/api/history/undo", params={"path": enc_path})  # undo CREATE posts
    _check("undo create table posts", r.json()["success"] is True, str(r.json()))
    r = client.get("/api/databases/metadata", params={"path": enc_path})
    names = [t["name"] for t in r.json()["schemas"][0]["tables"]]
    _check("posts dropped after undo", "posts" not in names, str(names))
    # Redo to restore posts.
    r = client.post("/api/history/redo", params={"path": enc_path})
    _check("redo create table posts", r.json()["success"] is True, str(r.json()))
    r = client.get("/api/databases/metadata", params={"path": enc_path})
    names = [t["name"] for t in r.json()["schemas"][0]["tables"]]
    _check("posts restored after redo", "posts" in names, str(names))

    # 11. Recommendations.
    r = client.get("/api/recommendations", params={"path": enc_path})
    _check("GET recommendations", r.status_code == 200)
    recs = r.json()
    _check("recommendations non-empty", len(recs) > 0, str(len(recs)))
    cats = {rec["category"] for rec in recs}
    _check("has multiple categories", len(cats) >= 3, str(cats))
    _check("recommendation has sql", all(rec.get("sql") for rec in recs), str(recs[:1]))

    # 12. Explain.
    r = client.post("/api/explain", json={"path": enc_path, "sql": "SELECT * FROM users WHERE age > 20;"})
    _check("explain", r.status_code == 200)
    expl = r.json()
    _check("explain plan non-empty", len(expl["plan"]) > 0, str(expl["plan"]))
    _check("explain estimated_cost >= 0", expl["estimated_cost"] >= 0)

    # 13. History.
    r = client.get("/api/history", params={"path": enc_path})
    _check("GET history", r.status_code == 200)
    hist = r.json()
    _check("history non-empty", len(hist["execution"]) > 0, str(hist))

    # 14. Saved queries.
    r = client.post("/api/saved-queries", json={"path": enc_path, "name": "all users", "sql": "SELECT * FROM users;"})
    _check("create saved query", r.status_code == 200)
    r = client.get("/api/saved-queries", params={"path": enc_path})
    _check("list saved queries", len(r.json()) == 1, str(r.json()))
    sid = r.json()[0]["id"]
    r = client.delete("/api/saved-queries", params={"path": enc_path, "id": sid})
    _check("delete saved query", r.json()["success"] is True)

    # 15. Export JSON.
    r = client.get("/api/export", params={"path": enc_path, "format": "json"})
    _check("export json", r.status_code == 200 and r.headers["content-type"].startswith("application/json"), str(r.headers.get("content-type")))

    # 16. Export SQL.
    r = client.get("/api/export", params={"path": enc_path, "format": "sql"})
    _check("export sql", r.status_code == 200 and "CREATE TABLE" in r.text, str(r.status_code))

    # 17. Export SVG.
    r = client.get("/api/export", params={"path": enc_path, "format": "svg"})
    _check("export svg", r.status_code == 200 and r.headers["content-type"] == "image/svg+xml", str(r.headers.get("content-type")))

    # 18. Export PNG.
    r = client.get("/api/export", params={"path": enc_path, "format": "png"})
    _check("export png", r.status_code == 200 and r.headers["content-type"] == "image/png", str(r.headers.get("content-type")))
    _check("png signature", r.content.startswith(b"\x89PNG"), str(r.content[:8]))

    # 19. Export PDF.
    r = client.get("/api/export", params={"path": enc_path, "format": "pdf"})
    _check("export pdf", r.status_code == 200 and r.headers["content-type"] == "application/pdf", str(r.headers.get("content-type")))
    _check("pdf header", r.content.startswith(b"%PDF"), str(r.content[:4]))

    # 20. Query error handled gracefully.
    r = client.post("/api/query", json={"path": enc_path, "sql": "SELECT * FROM nonexistent_table;"})
    _check("query error handled", r.status_code == 200 and r.json()["success"] is False, str(r.json()))
    _check("query error message", "no such table" in (r.json().get("error") or "").lower(), str(r.json().get("error")))

    # 21. Close database.
    r = client.delete("/api/databases", params={"path": enc_path})
    _check("DELETE database", r.json()["success"] is True, str(r.json()))

    print("\nALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()