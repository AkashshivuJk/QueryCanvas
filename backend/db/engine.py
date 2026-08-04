"""Database engine abstraction and SQLite implementation."""
from __future__ import annotations

import os
import re
import sqlite3
import time
from typing import Any, Optional

# Maximum rows returned by a SELECT query for display safety.
MAX_RESULT_ROWS = 1000


class DatabaseEngineBase:
    """Abstract base class describing the engine contract.

    Concrete implementations (SQLite, Postgres, MySQL) should subclass this.
    The extension seam documents how a new backend would plug in.
    """

    backend: str = "abstract"

    def __init__(self, path: str) -> None:
        self.path = path

    # --- lifecycle ---
    def close(self) -> None:
        raise NotImplementedError

    # --- introspection ---
    def metadata(self) -> dict[str, Any]:
        raise NotImplementedError

    def row_count(self, table: str) -> int:
        raise NotImplementedError

    def rows(
        self,
        table: str,
        limit: int = 100,
        offset: int = 0,
        sort: Optional[str] = None,
        dir_: str = "asc",
        search: Optional[str] = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    # --- execution ---
    def execute(self, sql: str) -> tuple[sqlite3.Cursor, str]:
        raise NotImplementedError

    def explain(self, sql: str) -> list[dict[str, Any]]:
        raise NotImplementedError

    def update_cell(
        self, table: str, rowid: int, column: str, value: Any
    ) -> int:
        raise NotImplementedError


class SQLiteEngine(DatabaseEngineBase):
    """SQLite-backed implementation using stdlib sqlite3."""

    backend = "sqlite"

    def __init__(self, path: str) -> None:
        super().__init__(path)
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        # Enable foreign keys for integrity.
        self.connection.execute("PRAGMA foreign_keys = ON;")
        self.last_insert_rowid: Optional[int] = None

    def close(self) -> None:
        try:
            self.connection.close()
        except sqlite3.Error:
            pass

    # --- introspection -----------------------------------------------------

    def _table_names(self, type_: str = "table") -> list[str]:
        cur = self.connection.execute(
            "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
            (type_,),
        )
        return [r[0] for r in cur.fetchall()]

    def _view_names(self) -> list[str]:
        return self._table_names("view")

    def row_count(self, table: str) -> int:
        try:
            cur = self.connection.execute(
                f'SELECT COUNT(*) FROM "{self._safe_ident(table)}"'
            )
            return int(cur.fetchone()[0])
        except sqlite3.Error:
            return 0

    def _table_columns(self, table: str) -> list[dict[str, Any]]:
        cols: list[dict[str, Any]] = []
        try:
            info = self.connection.execute(
                f'PRAGMA table_info("{self._safe_ident(table)}")'
            ).fetchall()
        except sqlite3.Error:
            return cols
        fks = self.connection.execute(
            f'PRAGMA foreign_key_list("{self._safe_ident(table)}")'
        ).fetchall()
        fk_map: dict[int, list[dict[str, str]]] = {}
        for fk in fks:
            # fk: (id, seq, table, from, to, on_update, on_delete, match)
            fk_map.setdefault(fk["from"], []).append(
                {"table": fk["table"], "column": fk["to"]}
            )
        pk_cols = [r["name"] for r in info if r["pk"]]
        for r in info:
            cols.append(
                {
                    "name": r["name"],
                    "data_type": (r["type"] or "").upper() or "TEXT",
                    "nullable": not bool(r["notnull"]),
                    "default": r["dflt_value"],
                    "is_pk": bool(r["pk"]),
                    "is_fk": r["name"] in fk_map,
                    "fk_references": fk_map.get(r["name"], []),
                }
            )
        return cols

    def _table_indexes(self, table: str) -> list[dict[str, Any]]:
        idx: list[dict[str, Any]] = []
        try:
            idx_list = self.connection.execute(
                f'PRAGMA index_list("{self._safe_ident(table)}")'
            ).fetchall()
        except sqlite3.Error:
            return idx
        for r in idx_list:
            cols = []
            try:
                info = self.connection.execute(
                    f'PRAGMA index_info("{self._safe_ident(r["name"])}")'
                ).fetchall()
                cols = [c["name"] for c in info]
            except sqlite3.Error:
                cols = []
            idx.append(
                {
                    "name": r["name"],
                    "columns": cols,
                    "unique": bool(r["unique"]),
                }
            )
        return idx

    def _table_triggers(self, table: str) -> list[dict[str, Any]]:
        trigs: list[dict[str, Any]] = []
        try:
            cur = self.connection.execute(
                "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name = ?",
                (table,),
            )
            for r in cur.fetchall():
                sql = r["sql"] or ""
                event = ""
                timing = ""
                m = re.search(
                    r"\b(BEFORE|AFTER|INSTEAD\s+OF)\b\s+(\w+)\b", sql, re.IGNORECASE
                )
                if m:
                    timing = m.group(1).upper()
                    event = m.group(2).upper()
                trigs.append(
                    {
                        "name": r["name"],
                        "event": event,
                        "timing": timing,
                        "statement": sql,
                    }
                )
        except sqlite3.Error:
            pass
        return trigs

    def _table_foreign_keys(self, table: str) -> list[dict[str, Any]]:
        fks: list[dict[str, Any]] = []
        try:
            rows = self.connection.execute(
                f'PRAGMA foreign_key_list("{self._safe_ident(table)}")'
            ).fetchall()
        except sqlite3.Error:
            return fks
        for r in rows:
            fks.append(
                {
                    "name": "",
                    "from_column": r["from"],
                    "to_table": r["table"],
                    "to_column": r["to"],
                }
            )
        return fks

    def _table_constraints(self, table: str) -> list[dict[str, Any]]:
        """Return best-effort constraints from the table definition."""
        cons: list[dict[str, Any]] = []
        try:
            sql = self.connection.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
                (table,),
            ).fetchone()
            if not sql or not sql["sql"]:
                return cons
            definition = sql["sql"]
        except sqlite3.Error:
            return cons
        # PRIMARY KEY
        m = re.search(
            r"PRIMARY\s+KEY\s*\(([^)]+)\)", definition, re.IGNORECASE
        )
        if m:
            cols = [c.strip().strip('"`[]') for c in m.group(1).split(",")]
            cons.append(
                {
                    "name": f"pk_{table}",
                    "type": "PRIMARY KEY",
                    "columns": cols,
                    "definition": f"PRIMARY KEY ({', '.join(cols)})",
                }
            )
        # UNIQUE
        for um in re.finditer(
            r"UNIQUE\s*\(([^)]+)\)", definition, re.IGNORECASE
        ):
            cols = [c.strip().strip('"`[]') for c in um.group(1).split(",")]
            cons.append(
                {
                    "name": f"uq_{table}_{len(cons)}",
                    "type": "UNIQUE",
                    "columns": cols,
                    "definition": f"UNIQUE ({', '.join(cols)})",
                }
            )
        return cons

    def metadata(self) -> dict[str, Any]:
        tables_meta: list[dict[str, Any]] = []
        for t in self._table_names("table"):
            tables_meta.append(
                {
                    "name": t,
                    "type": "table",
                    "row_count": self.row_count(t),
                    "columns": self._table_columns(t),
                    "indexes": self._table_indexes(t),
                    "constraints": self._table_constraints(t),
                    "triggers": self._table_triggers(t),
                    "foreign_keys": self._table_foreign_keys(t),
                }
            )
        views_meta: list[dict[str, Any]] = []
        for v in self._view_names():
            views_meta.append(
                {
                    "name": v,
                    "type": "view",
                    "row_count": self.row_count(v),
                    "columns": self._table_columns(v),
                    "indexes": [],
                    "constraints": [],
                    "triggers": self._table_triggers(v),
                    "foreign_keys": [],
                }
            )
        all_indexes = []
        try:
            cur = self.connection.execute(
                "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name"
            )
            for r in cur.fetchall():
                all_indexes.append({"name": r["name"], "table": r["tbl_name"]})
        except sqlite3.Error:
            pass
        all_triggers = []
        try:
            cur = self.connection.execute(
                "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' ORDER BY name"
            )
            for r in cur.fetchall():
                all_triggers.append(
                    {"name": r["name"], "table": r["tbl_name"], "sql": r["sql"]}
                )
        except sqlite3.Error:
            pass
        schema_views = [v["name"] for v in views_meta]
        schema_triggers = [t["name"] for t in all_triggers]
        return {
            "database": os.path.basename(self.path),
            "views": schema_views,
            "indexes": [i["name"] for i in all_indexes],
            "functions": [],
            "triggers": schema_triggers,
            "schemas": [
                {
                    "name": "main",
                    "tables": tables_meta,
                    "views": views_meta,
                    "indexes": all_indexes,
                    "functions": [],
                    "triggers": all_triggers,
                }
            ],
        }

    # --- rows ---------------------------------------------------------------

    def _safe_ident(self, ident: str) -> str:
        """Sanitize an identifier for embedding into dynamic SQL."""
        # Only allow alnum + underscore; otherwise reject.
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", ident):
            raise ValueError(f"Invalid identifier: {ident!r}")
        return ident.replace('"', '""')

    def _text_columns(self, table: str) -> list[str]:
        return [c["name"] for c in self._table_columns(table)]

    def rows(
        self,
        table: str,
        limit: int = 100,
        offset: int = 0,
        sort: Optional[str] = None,
        dir_: str = "asc",
        search: Optional[str] = None,
    ) -> dict[str, Any]:
        self._safe_ident(table)
        cols = [c["name"] for c in self._table_columns(table)]
        if not cols:
            raise ValueError(f"Unknown table or no columns: {table!r}")
        select_cols = ", ".join(f'"{self._safe_ident(c)}"' for c in cols)
        where_parts: list[str] = []
        params: list[Any] = []
        if search:
            or_clauses = []
            for c in cols:
                or_clauses.append(f'CAST("{self._safe_ident(c)}" AS TEXT) LIKE ?')
                params.append(f"%{search}%")
            if or_clauses:
                where_parts.append("(" + " OR ".join(or_clauses) + ")")
        order_clause = ""
        if sort:
            # Whitelist sort column against schema.
            if sort not in cols:
                raise ValueError(f"Invalid sort column: {sort!r}")
            direction = "DESC" if dir_.lower() == "desc" else "ASC"
            order_clause = f' ORDER BY "{self._safe_ident(sort)}" {direction}'
        where_clause = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""
        limit = max(0, min(int(limit), MAX_RESULT_ROWS))
        offset = max(0, int(offset))
        q = (
            f'SELECT rowid, {select_cols} FROM "{self._safe_ident(table)}"'
            f"{where_clause}{order_clause} LIMIT ? OFFSET ?"
        )
        params.extend([limit, offset])
        cur = self.connection.execute(q, params)
        fetched = cur.fetchall()
        rows = [[r[c] for c in cols] for r in fetched]
        count_q = f'SELECT COUNT(*) FROM "{self._safe_ident(table)}"{where_clause}'
        count_params = params[:-2]  # remove limit/offset
        total = self.connection.execute(count_q, count_params).fetchone()[0]
        return {
            "columns": cols,
            "rows": rows,
            "total": int(total),
            "limit": limit,
            "offset": offset,
        }

    def update_cell(
        self, table: str, rowid: int, column: str, value: Any
    ) -> int:
        self._safe_ident(table)
        self._safe_ident(column)
        q = f'UPDATE "{self._safe_ident(table)}" SET "{self._safe_ident(column)}" = ? WHERE rowid = ?'
        cur = self.connection.execute(q, (value, int(rowid)))
        self.connection.commit()
        return cur.rowcount

    # --- execution ---------------------------------------------------------

    def execute(self, sql: str) -> tuple[sqlite3.Cursor, str]:
        cur = self.connection.execute(sql)
        self.connection.commit()
        # Detect SELECT by checking if description is present.
        if cur.description is not None:
            # Fetch but do not mutate state further.
            pass
        try:
            self.last_insert_rowid = self.connection.execute(
                "SELECT last_insert_rowid()"
            ).fetchone()[0]
        except sqlite3.Error:
            self.last_insert_rowid = None
        return cur, "executed"

    def execute_select(self, sql: str, cap: int = MAX_RESULT_ROWS) -> tuple[list[str], list[list[Any]]]:
        """Execute a SELECT and return (columns, rows) capped at `cap` rows."""
        cur = self.connection.execute(sql)
        self.connection.commit()
        if cur.description is None:
            return [], []
        cols = [d[0] for d in cur.description]
        rows = [list(r) for r in cur.fetchmany(cap)]
        return cols, rows

    def explain(self, sql: str) -> list[dict[str, Any]]:
        cur = self.connection.execute(f"EXPLAIN QUERY PLAN {sql}")
        plan: list[dict[str, Any]] = []
        for r in cur.fetchall():
            plan.append(
                {
                    "id": r["id"],
                    "parent": r["parent"],
                    "notused": r["notused"],
                    "detail": r["detail"],
                }
            )
        return plan

    def get_schema_sql(self) -> str:
        """Return all CREATE statements from sqlite_master."""
        cur = self.connection.execute(
            "SELECT sql FROM sqlite_master "
            "WHERE sql IS NOT NULL AND type IN ('table','index','view','trigger') "
            "ORDER BY type, name"
        )
        return "\n\n".join((r[0] or "") for r in cur.fetchall()) + "\n"

    def get_data_dump(self) -> str:
        """Return INSERT statements for all table data."""
        lines: list[str] = []
        for t in self._table_names("table"):
            cols = [c["name"] for c in self._table_columns(t)]
            if not cols:
                continue
            col_list = ", ".join(f'"{self._safe_ident(c)}"' for c in cols)
            cur = self.connection.execute(
                f'SELECT {col_list} FROM "{self._safe_ident(t)}"'
            )
            for r in cur.fetchall():
                vals = []
                for v in r:
                    if v is None:
                        vals.append("NULL")
                    elif isinstance(v, (int, float)):
                        vals.append(str(v))
                    else:
                        escaped = str(v).replace("'", "''")
                        vals.append(f"'{escaped}'")
                lines.append(
                    f'INSERT INTO "{self._safe_ident(t)}" ({col_list}) VALUES ({", ".join(vals)});'
                )
        return "\n".join(lines)


class PostgresEngine(DatabaseEngineBase):
    """Placeholder Postgres engine.

    Connection parameters would come from config (host/port/user/dbname).
    Implement using psycopg or asyncpg. Not implemented in this build.
    """

    backend = "postgres"

    def __init__(self, path: str) -> None:
        super().__init__(path)
        raise NotImplementedError(
            "PostgresEngine is an extension seam; not implemented. "
            "Connection params belong in config.py."
        )


class MySQLEngine(DatabaseEngineBase):
    """Placeholder MySQL engine.

    Connection parameters would come from config (host/port/user/dbname).
    Implement using mysql-connector or PyMySQL. Not implemented in this build.
    """

    backend = "mysql"

    def __init__(self, path: str) -> None:
        super().__init__(path)
        raise NotImplementedError(
            "MySQLEngine is an extension seam; not implemented. "
            "Connection params belong in config.py."
        )


def get_engine(backend: str, path: str) -> DatabaseEngineBase:
    """Factory returning the appropriate engine for a backend name."""
    backend = (backend or "sqlite").lower()
    if backend == "sqlite":
        return SQLiteEngine(path)
    if backend == "postgres":
        return PostgresEngine(path)
    if backend == "mysql":
        return MySQLEngine(path)
    raise ValueError(f"Unknown backend: {backend!r}")


def db_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0