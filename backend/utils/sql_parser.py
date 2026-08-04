"""SQL classification and inverse-statement generation."""
from __future__ import annotations

import re
import sqlite3
from typing import Optional

# Keywords that identify schema-changing statements.
_SCHEMA_DDL_VERBS = {"CREATE", "DROP", "ALTER"}
_SCHEMA_DML_VERBS = {"INSERT", "UPDATE", "DELETE"}


def classify(sql: str) -> tuple[str, bool]:
    """Classify a SQL statement.

    Returns (statement_type, schema_changed) where statement_type is one of
    'SELECT', 'DDL', 'DML', 'UNKNOWN' and schema_changed is True for any
    CREATE/DROP/ALTER/RENAME or INSERT/UPDATE/DELETE statement.
    """
    if not sql or not sql.strip():
        return "UNKNOWN", False
    stripped = sql.strip().lstrip("(").strip()
    # Remove leading comments.
    while stripped.startswith("--"):
        nl = stripped.find("\n")
        if nl == -1:
            stripped = ""
            break
        stripped = stripped[nl + 1 :].strip()
    if not stripped:
        return "UNKNOWN", False
    first = stripped.split(None, 1)[0].upper() if stripped.split() else ""
    if first == "SELECT" or first == "WITH":
        return "SELECT", False
    if first in _SCHEMA_DDL_VERBS:
        return "DDL", True
    if first in _SCHEMA_DML_VERBS:
        return "DML", True
    if first in ("PRAGMA", "EXPLAIN"):
        return "SELECT", False
    return "UNKNOWN", False


def split_statements(sql: str) -> list[str]:
    """Split SQL into individual statements on semicolons.

    A simple scanner tracks whether the current position is inside a
    single-quoted string literal, a line comment (``-- ...``), or a block
    comment (``/* ... */``) so that semicolons inside those contexts do not
    act as statement separators. Empty/whitespace-only statements are
    filtered out and each returned statement is trimmed.
    """
    if sql is None:
        return []
    text = sql
    if ";" not in text:
        stripped = text.strip()
        return [stripped] if stripped else []

    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(text)
    in_single = False  # inside '...' string literal
    in_line = False  # inside -- ... line comment
    in_block = False  # inside /* ... */ block comment

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if in_single:
            buf.append(ch)
            if ch == "'":
                if nxt == "'":
                    # Escaped quote '' stays inside the string.
                    buf.append(nxt)
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if in_line:
            buf.append(ch)
            if ch == "\n":
                in_line = False
            i += 1
            continue

        if in_block:
            buf.append(ch)
            if ch == "*" and nxt == "/":
                buf.append(nxt)
                in_block = False
                i += 2
                continue
            i += 1
            continue

        # Not inside any string/comment context.
        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue
        if ch == "-" and nxt == "-":
            in_line = True
            buf.append(ch)
            buf.append(nxt)
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block = True
            buf.append(ch)
            buf.append(nxt)
            i += 2
            continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    # Trailing content after the last semicolon.
    stmt = "".join(buf).strip()
    if stmt:
        statements.append(stmt)

    return statements


def _strip_semicolons(sql: str) -> str:
    return sql.strip().rstrip(";").strip()


def _first_table_for_insert(sql: str) -> Optional[str]:
    m = re.search(
        r"\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+\"?([^\s\"(]+)\"?", sql, re.IGNORECASE
    )
    if m:
        return m.group(1).strip('"')
    return None


def _table_and_col_for_alter(sql: str) -> Optional[tuple[str, str, str]]:
    """Return (table, column, action) for ALTER TABLE ... ADD/DROP COLUMN or RENAME."""
    m = re.search(
        r"\bALTER\s+TABLE\s+\"?([^\s\"(]+)\"?\s+ADD\s+COLUMN\s+\"?([^\s\"(\s]+)\"?",
        sql,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip('"'), m.group(2).strip('"'), "ADD"
    m = re.search(
        r"\bALTER\s+TABLE\s+\"?([^\s\"(]+)\"?\s+DROP\s+COLUMN\s+\"?([^\s\"(\s]+)\"?",
        sql,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip('"'), m.group(2).strip('"'), "DROP"
    m = re.search(
        r"\bALTER\s+TABLE\s+\"?([^\s\"(]+)\"?\s+RENAME\s+(?:TO|COLUMN\s+\S+\s+TO)\s+\"?([^\s\"(]+)\"?",
        sql,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip('"'), m.group(2).strip('"'), "RENAME"
    return None


def _create_table_name(sql: str) -> Optional[str]:
    m = re.search(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\"?([^\s\"(]+)\"?", sql, re.IGNORECASE)
    if m:
        return m.group(1).strip('"')
    return None


def _drop_table_name(sql: str) -> Optional[str]:
    m = re.search(r"\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?\"?([^\s\"(;]+)\"?", sql, re.IGNORECASE)
    if m:
        return m.group(1).strip('"')
    return None


def _create_index_name(sql: str) -> Optional[str]:
    m = re.search(
        r"\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\"?([^\s\"(]+)\"?",
        sql,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip('"')
    return None


def _drop_index_name(sql: str) -> Optional[str]:
    m = re.search(r"\bDROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?\"?([^\s\"(;]+)\"?", sql, re.IGNORECASE)
    if m:
        return m.group(1).strip('"')
    return None


def _master_sql(connection: sqlite3.Connection, name: str, type_: str) -> Optional[str]:
    """Return the CREATE statement for an object from sqlite_master."""
    cur = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = ? AND type = ?",
        (name, type_),
    )
    row = cur.fetchone()
    if row and row[0]:
        return row[0]
    return None


def _quote_ident(name: str) -> str:
    """Quote an identifier for safe SQL embedding."""
    return '"' + name.replace('"', '""') + '"'


def _where_clause(sql: str) -> Optional[str]:
    """Extract the WHERE clause text from an UPDATE or DELETE statement."""
    m = re.search(r"\bWHERE\b(.+?)(?:\bORDER\s+BY\b|\bLIMIT\b|;|$)", sql, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).strip()
    return None


def _table_for_update_delete(sql: str) -> Optional[str]:
    m = re.search(r"\bUPDATE\s+\"?([^\s\"(]+)\"?", sql, re.IGNORECASE)
    if m:
        return m.group(1).strip('"')
    m = re.search(r"\bDELETE\s+FROM\s+\"?([^\s\"(]+)\"?", sql, re.IGNORECASE)
    if m:
        return m.group(1).strip('"')
    return None


def _column_names(connection: sqlite3.Connection, table: str) -> list[str]:
    try:
        cur = connection.execute(f"PRAGMA table_info({_quote_ident(table)})")
        return [r[1] for r in cur.fetchall()]
    except sqlite3.Error:
        return []


def _pk_columns(connection: sqlite3.Connection, table: str) -> list[str]:
    try:
        cur = connection.execute(f"PRAGMA table_info({_quote_ident(table)})")
        return [r[1] for r in cur.fetchall() if r[5]]
    except sqlite3.Error:
        return []


def sqlite_version(connection: sqlite3.Connection) -> tuple[int, int, int]:
    v = connection.execute("SELECT sqlite_version()").fetchone()[0]
    parts = v.split(".")
    return (int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)


def generate_inverse(connection: sqlite3.Connection, sql: str) -> tuple[str, str]:
    """Generate the inverse SQL for a schema-changing statement.

    Must be called BEFORE executing the original statement for DROP/UPDATE/DELETE
    so the current state can be captured. For INSERT, capture happens after
    execution (handled by the caller via last_insert_rowid).

    Returns (op_type, inverse_sql). op_type is one of:
    'CREATE_TABLE','DROP_TABLE','ALTER_TABLE','CREATE_INDEX','DROP_INDEX',
    'INSERT','UPDATE','DELETE','UNKNOWN'.
    """
    sql = _strip_semicolons(sql)
    upper = sql.upper()

    # CREATE TABLE x -> DROP TABLE x
    if re.match(r"\s*CREATE\s+TABLE", upper):
        name = _create_table_name(sql)
        if name:
            return "CREATE_TABLE", f"DROP TABLE IF EXISTS {_quote_ident(name)};"
        return "CREATE_TABLE", ""

    # DROP TABLE x -> capture original CREATE before drop
    if re.match(r"\s*DROP\s+TABLE", upper):
        name = _drop_table_name(sql)
        if name:
            original = _master_sql(connection, name, "table")
            if original:
                return "DROP_TABLE", original.rstrip(";") + ";"
            return "DROP_TABLE", ""
        return "DROP_TABLE", ""

    # CREATE INDEX i -> DROP INDEX i
    if re.match(r"\s*CREATE\s+(?:UNIQUE\s+)?INDEX", upper):
        name = _create_index_name(sql)
        if name:
            return "CREATE_INDEX", f"DROP INDEX IF EXISTS {_quote_ident(name)};"
        return "CREATE_INDEX", ""

    # DROP INDEX i -> capture original CREATE INDEX
    if re.match(r"\s*DROP\s+INDEX", upper):
        name = _drop_index_name(sql)
        if name:
            original = _master_sql(connection, name, "index")
            if original:
                return "DROP_INDEX", original.rstrip(";") + ";"
            return "DROP_INDEX", ""
        return "DROP_INDEX", ""

    # ALTER TABLE x ADD/DROP COLUMN c / RENAME TO y
    if re.match(r"\s*ALTER\s+TABLE", upper):
        info = _table_and_col_for_alter(sql)
        if info:
            table, col, action = info
            if action == "ADD":
                # Inverse: DROP COLUMN if supported, else recreate without column.
                maj, minr, _ = sqlite_version(connection)
                if (maj, minr) >= (3, 35):
                    return "ALTER_TABLE", (
                        f"ALTER TABLE {_quote_ident(table)} DROP COLUMN {_quote_ident(col)};"
                    )
                return "ALTER_TABLE", f"-- manual recreate of {_quote_ident(table)} without {col}"
            if action == "DROP":
                return "ALTER_TABLE", f"-- cannot restore dropped column {col}"
            if action == "RENAME":
                # ALTER TABLE y RENAME TO x (old name)
                return "ALTER_TABLE", (
                    f"ALTER TABLE {_quote_ident(col)} RENAME TO {_quote_ident(table)};"
                )
        return "ALTER_TABLE", ""

    # INSERT INTO x VALUES(...) -> inverse handled post-execute by caller.
    if re.match(r"\s*INSERT", upper):
        return "INSERT", ""

    # UPDATE x SET ... WHERE ... -> capture pre-update rows
    if re.match(r"\s*UPDATE", upper):
        table = _table_for_update_delete(sql)
        if not table:
            return "UPDATE", ""
        where = _where_clause(sql)
        cols = _column_names(connection, table)
        if not cols:
            return "UPDATE", ""
        cond = f"WHERE {where}" if where else ""
        try:
            cur = connection.execute(
                f"SELECT rowid, {', '.join(_quote_ident(c) for c in cols)} "
                f"FROM {_quote_ident(table)} {cond}"
            )
            rows = cur.fetchall()
        except sqlite3.Error:
            return "UPDATE", ""
        if not rows:
            return "UPDATE", "-- no rows affected"
        set_clause = ", ".join(
            f"{_quote_ident(c)} = ?" for c in cols
        )
        statements: list[str] = []
        for r in rows:
            rowid = r[0]
            vals = list(r[1:])
            placeholders = ", ".join("?" for _ in vals)
            statements.append(
                f"UPDATE {_quote_ident(table)} SET {set_clause} "
                f"WHERE rowid = {int(rowid)}; -- params: {vals!r}"
            )
        return "UPDATE", "\n".join(statements)

    # DELETE FROM x WHERE ... -> capture rows to re-insert
    if re.match(r"\s*DELETE", upper):
        table = _table_for_update_delete(sql)
        if not table:
            return "DELETE", ""
        where = _where_clause(sql)
        cols = _column_names(connection, table)
        if not cols:
            return "DELETE", ""
        cond = f"WHERE {where}" if where else ""
        try:
            cur = connection.execute(
                f"SELECT {', '.join(_quote_ident(c) for c in cols)} "
                f"FROM {_quote_ident(table)} {cond}"
            )
            rows = cur.fetchall()
        except sqlite3.Error:
            return "DELETE", ""
        if not rows:
            return "DELETE", "-- no rows deleted"
        col_list = ", ".join(_quote_ident(c) for c in cols)
        statements: list[str] = []
        for r in rows:
            placeholders = ", ".join("?" for _ in r)
            statements.append(
                f"INSERT INTO {_quote_ident(table)} ({col_list}) "
                f"VALUES ({placeholders}); -- params: {list(r)!r}"
            )
        return "DELETE", "\n".join(statements)

    return "UNKNOWN", ""


def inverse_for_insert(connection: sqlite3.Connection, sql: str) -> str:
    """Build the DELETE inverse for an INSERT, using last_insert_rowid()."""
    table = _first_table_for_insert(sql)
    if not table:
        return ""
    try:
        rowid = connection.execute("SELECT last_insert_rowid()").fetchone()[0]
    except sqlite3.Error:
        return ""
    if rowid is None or rowid == 0:
        return ""
    return f"DELETE FROM {_quote_ident(table)} WHERE rowid = {int(rowid)};"