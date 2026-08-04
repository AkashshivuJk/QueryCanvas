# API Reference

Base URL: `http://localhost:8000/api` (all routes are mounted under `/api`).

All JSON request/response bodies are described by the Pydantic models in `backend/models.py` and mirrored in the frontend `types/index.ts` (re-exported from `shared/types.ts`). The frontend development server proxies `/api` to the backend.

> **Databases must be open before they can be queried.** Every endpoint except `POST /databases` expects the database to already be open (created or opened).

---

## Databases

### `GET /api/databases`

List all currently open databases.

**Response** — array of `DatabaseInfo`:

```json
[
  {
    "path": "/Users/me/data/myapp.db",
    "name": "myapp",
    "size_bytes": 24576,
    "backend": "sqlite"
  }
]
```

**cURL**

```bash
curl http://localhost:8000/api/databases
```

---

### `POST /api/databases`

Create a new database or open an existing one.

**Request body** — `DatabaseCreateRequest`:

```json
{
  "action": "create",
  "path": "/Users/me/data/myapp.db",
  "name": "myapp"
}
```

- `action`: `"create"` or `"open"` (required).
- `path`: database file path (required).
- `name`: optional display name (ignored internally; sourced from the filename).

**Response** — `DatabaseInfo` (same shape as list items).

```json
{
  "path": "/Users/me/data/myapp.db",
  "name": "myapp",
  "size_bytes": 24576,
  "backend": "sqlite"
}
```

**Errors** — `400` if the file already exists on `create` or `action` is invalid; `404` if the file is missing on `open`.

**cURL**

```bash
curl -X POST http://localhost:8000/api/databases \
  -H 'Content-Type: application/json' \
  -d '{"action":"create","path":"/tmp/demo.db"}'
```

---

### `DELETE /api/databases`

Close an open database (removes it from the registry and its undo manager).

**Query params** — `path` (required).

**Response**

```json
{
  "success": true,
  "path": "/Users/me/data/myapp.db"
}
```

**Errors** — `404` if the database is not open.

**cURL**

```bash
curl -X DELETE "http://localhost:8000/api/databases?path=/tmp/demo.db"
```

---

### `GET /api/databases/metadata`

Return the full schema metadata for an open database.

**Query params** — `path` (required).

**Response** — `Metadata`. Nested structure:

```json
{
  "database": "myapp.db",
  "schemas": [
    {
      "name": "main",
      "tables": [
        {
          "name": "users",
          "type": "table",
          "row_count": 3,
          "columns": [
            {
              "name": "id",
              "data_type": "INTEGER",
              "nullable": false,
              "default": null,
              "is_pk": true,
              "is_fk": false,
              "fk_references": []
            }
          ],
          "indexes": [
            {
              "name": "sqlite_autoindex_users_1",
              "columns": ["id"],
              "unique": true
            }
          ],
          "constraints": [
            {
              "name": "PK_users",
              "type": "PRIMARY KEY",
              "columns": ["id"],
              "definition": "PRIMARY KEY (id)"
            }
          ],
          "triggers": [],
          "foreign_keys": [
            {
              "name": "fk_orders_user",
              "from_column": "user_id",
              "to_table": "users",
              "to_column": "id"
            }
          ]
        }
      ],
      "views": [],
      "indexes": [
        {
          "name": "idx_users_email",
          "table": "users"
        }
      ],
      "functions": [],
      "triggers": [
        {
          "name": "trg_updated_at",
          "table": "users",
          "sql": "CREATE TRIGGER ..."
        }
      ]
    }
  ]
}
```

- `ColumnInfo`: `name`, `data_type`, `nullable`, `default`, `is_pk`, `is_fk`, `fk_references: [{table, column}]`.
- `TableInfo`: `name`, `type` (`"table"` | `"view"`), `row_count`, `columns[]`, `indexes[]`, `constraints[]`, `triggers[]`, `foreign_keys[]`.

**Errors** — `404` if the database is not open; `400` on introspection failure.

**cURL**

```bash
curl "http://localhost:8000/api/databases/metadata?path=/tmp/demo.db"
```

---

### `GET /api/databases/tables/rows`

Fetch rows from a table with pagination, sorting, and search.

**Query params**

| Param | Default | Notes |
| --- | --- | --- |
| `path` | — | required |
| `table` | — | required |
| `limit` | `100` | `0..1000` |
| `offset` | `0` | `>= 0` |
| `sort` | — | column name to sort by |
| `dir` | `asc` | `asc` \| `desc` |
| `search` | — | substring match across text columns |

**Response** — `RowsResponse`:

```json
{
  "columns": ["id", "name", "email"],
  "rows": [
    [1, "Alice", "alice@example.com"],
    [2, "Bob", "bob@example.com"]
  ],
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

**Errors** — `400` on invalid table name, sort column, or unknown table.

**cURL**

```bash
curl "http://localhost:8000/api/databases/tables/rows?path=/tmp/demo.db&table=users&limit=50&search=alice"
```

---

### `POST /api/databases/cells`

Edit a single cell value (in-place table edit).

**Request body** — `CellEditRequest`:

```json
{
  "path": "/tmp/demo.db",
  "table": "users",
  "rowid": 1,
  "column": "name",
  "value": "Alicia"
}
```

**Response**

```json
{
  "success": true,
  "rowid": 1,
  "affected": 1
}
```

**Errors** — `404` if database not open; `400` on invalid identifiers.

**cURL**

```bash
curl -X POST http://localhost:8000/api/databases/cells \
  -H 'Content-Type: application/json' \
  -d '{"path":"/tmp/demo.db","table":"users","rowid":1,"column":"name","value":"Alicia"}'
```

---

## Query

### `POST /api/query`

Execute a SQL statement against an open database. Records execution history and captures undo state for schema-changing statements.

**Request body** — `QueryRequest`:

```json
{
  "path": "/tmp/demo.db",
  "sql": "SELECT * FROM users;"
}
```

**Response** — `QueryResult`:

```json
{
  "columns": ["id", "name", "email"],
  "rows": [[1, "Alice", "alice@example.com"]],
  "affected_rows": 0,
  "execution_time_ms": 0.42,
  "success": true,
  "error": null,
  "statement_type": "SELECT",
  "schema_changed": false
}
```

For a non-SELECT statement (e.g. `INSERT`), `affected_rows` is populated and `schema_changed` becomes `true` (for `CREATE`/`DROP`/`ALTER`/`INSERT`/`UPDATE`/`DELETE`):

```json
{
  "columns": [],
  "rows": [],
  "affected_rows": 1,
  "execution_time_ms": 0.31,
  "success": true,
  "error": null,
  "statement_type": "DML",
  "schema_changed": true
}
```

On a SQL error the response still uses HTTP 200 with `success: false`:

```json
{
  "columns": [],
  "rows": [],
  "affected_rows": 0,
  "execution_time_ms": 0.1,
  "success": false,
  "error": "no such table: nope",
  "statement_type": "SELECT",
  "schema_changed": false
}
```

**Errors** — `404` if the database is not open; `400` on unexpected failures.

**cURL**

```bash
curl -X POST http://localhost:8000/api/query \
  -H 'Content-Type: application/json' \
  -d '{"path":"/tmp/demo.db","sql":"SELECT COUNT(*) AS n FROM users;"}'
```

---

### `POST /api/explain`

Explain the query plan for a `SELECT` statement.

**Request body** — `QueryRequest` (same as `/query`).

**Response** — `ExplainResult`:

```json
{
  "plan": [
    {
      "id": 0,
      "parent": 0,
      "notused": 0,
      "detail": "SCAN users"
    }
  ],
  "estimated_cost": 1,
  "indexes_used": [],
  "suggestions": [
    "Full table scan detected on users.",
    "No index used on table users - consider adding one."
  ],
  "potential_problems": [
    "Full table scan detected on users."
  ]
}
```

**cURL**

```bash
curl -X POST http://localhost:8000/api/explain \
  -H 'Content-Type: application/json' \
  -d '{"path":"/tmp/demo.db","sql":"SELECT * FROM users WHERE email = ?"}'
```

---

## History

### `GET /api/history`

Return execution history plus the current undo/redo stacks.

**Query params** — `path` (required).

**Response** — `HistoryResponse`:

```json
{
  "execution": [
    {
      "id": "3f2b...",
      "sql": "CREATE TABLE users ...",
      "timestamp": "2025-01-01T00:00:00Z",
      "execution_time_ms": 1.2,
      "affected_rows": 0,
      "success": true,
      "error": null,
      "favorite": false,
      "statement_type": "DDL"
    }
  ],
  "undo_stack": [
    {
      "sql": "CREATE TABLE users ...",
      "inverse_sql": "DROP TABLE IF EXISTS \"users\";",
      "timestamp": "2025-01-01T00:00:00Z",
      "op_type": "CREATE_TABLE"
    }
  ],
  "redo_stack": []
}
```

History is capped at 200 records per database and stored in memory.

**cURL**

```bash
curl "http://localhost:8000/api/history?path=/tmp/demo.db"
```

---

### `POST /api/history/undo`

Undo the most recent schema-changing statement by executing its inverse.

**Query params** — `path` (required).

**Response** — `UndoRedoResult`:

```json
{
  "success": true,
  "sql_executed": "DROP TABLE IF EXISTS \"users\";",
  "metadata_changed": true,
  "error": null
}
```

If there is nothing to undo:

```json
{
  "success": false,
  "sql_executed": "",
  "metadata_changed": false,
  "error": "Nothing to undo"
}
```

**cURL**

```bash
curl -X POST "http://localhost:8000/api/history/undo?path=/tmp/demo.db"
```

---

### `POST /api/history/redo`

Redo the most recent undone change by re-executing the original statement.

**Query params** — `path` (required).

**Response** — `UndoRedoResult` (same shape as undo):

```json
{
  "success": true,
  "sql_executed": "CREATE TABLE users ...",
  "metadata_changed": true,
  "error": null
}
```

**cURL**

```bash
curl -X POST "http://localhost:8000/api/history/redo?path=/tmp/demo.db"
```

---

### `POST /api/history/favorite`

Mark or unmark a history entry as a favorite.

**Request body** — `FavoriteRequest`:

```json
{
  "path": "/tmp/demo.db",
  "history_id": "3f2b...",
  "favorite": true
}
```

**Response**

```json
{
  "success": true,
  "history_id": "3f2b...",
  "favorite": true
}
```

**cURL**

```bash
curl -X POST http://localhost:8000/api/history/favorite \
  -H 'Content-Type: application/json' \
  -d '{"path":"/tmp/demo.db","history_id":"3f2b...","favorite":true}'
```

---

### `POST /api/history/replay`

Re-run a saved history entry. It executes but does **not** record a new history entry or capture undo state.

**Query params** — `path`, `history_id` (both required).

**Response** — `QueryResult` (same shape as `/query`).

**Errors** — `404` if the history entry is not found.

**cURL**

```bash
curl -X POST "http://localhost:8000/api/history/replay?path=/tmp/demo.db&history_id=3f2b..."
```

---

## Saved Queries

Saved queries are stored per database **in memory** (not persisted across restarts).

### `GET /api/saved-queries`

**Query params** — `path` (required).

**Response** — array of `SavedQuery`:

```json
[
  {
    "id": "sq-1735689600000",
    "name": "Top users",
    "sql": "SELECT * FROM users ORDER BY id DESC LIMIT 10;",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

**cURL**

```bash
curl "http://localhost:8000/api/saved-queries?path=/tmp/demo.db"
```

---

### `POST /api/saved-queries`

Create a saved query.

**Request body** — `SavedQueryCreate`:

```json
{
  "path": "/tmp/demo.db",
  "name": "Top users",
  "sql": "SELECT * FROM users ORDER BY id DESC LIMIT 10;"
}
```

**Response** — a single `SavedQuery` object:

```json
{
  "id": "sq-1735689600000",
  "name": "Top users",
  "sql": "SELECT * FROM users ORDER BY id DESC LIMIT 10;",
  "created_at": "2025-01-01T00:00:00Z"
}
```

**cURL**

```bash
curl -X POST http://localhost:8000/api/saved-queries \
  -H 'Content-Type: application/json' \
  -d '{"path":"/tmp/demo.db","name":"Top users","sql":"SELECT * FROM users;"}'
```

---

### `DELETE /api/saved-queries`

Delete a saved query.

**Query params** — `path`, `id` (both required).

**Response**

```json
{
  "success": true,
  "id": "sq-1735689600000"
}
```

**cURL**

```bash
curl -X DELETE "http://localhost:8000/api/saved-queries?path=/tmp/demo.db&id=sq-1735689600000"
```

---

## Recommendations

### `GET /api/recommendations`

Return schema-driven SQL recommendations.

**Query params** — `path` (required).

**Response** — array of `Recommendation`:

```json
[
  {
    "id": "show-all-tables",
    "title": "Show all tables",
    "description": "List every table in the database.",
    "sql": "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
    "category": "overview"
  },
  {
    "id": "count-rows-all-tables",
    "title": "Count rows in every table",
    "description": "Return a row count for each table to spot empty or huge ones.",
    "sql": "SELECT 'users' AS table_name, COUNT(*) AS row_count FROM \"users\" UNION ALL ...;",
    "category": "overview"
  }
]
```

Categories: `overview` · `data_quality` · `performance` · `relationships` · `examples`.

**cURL**

```bash
curl "http://localhost:8000/api/recommendations?path=/tmp/demo.db"
```

---

## Export

### `GET /api/export`

Export the database schema (and data for SQL format) as a downloadable file.

**Query params**

| Param | Default | Notes |
| --- | --- | --- |
| `path` | — | required |
| `format` | `json` | `json` \| `sql` \| `svg` \| `png` \| `pdf` |

**Response** — a binary/text file blob. Each format sets an appropriate `Content-Type` and `Content-Disposition`:

| Format | Content-Type | Filename |
| --- | --- | --- |
| `json` | `application/json` | `schema.json` |
| `sql` | `application/sql` | `schema.sql` |
| `svg` | `image/svg+xml` | `schema.svg` |
| `png` | `image/png` | `schema.png` |
| `pdf` | `application/pdf` | `schema.pdf` |

- `json` — the full metadata object (same as `GET /databases/metadata`).
- `sql` — `CREATE` statements plus `INSERT` data dumps.
- `svg` / `png` / `pdf` — generated pure-Python schema diagram renders (no external rasterizer).

**Errors** — `404` if the database is not open; `400` for an unsupported format.

**cURL**

```bash
curl -o schema.json  "http://localhost:8000/api/export?path=/tmp/demo.db&format=json"
curl -o schema.sql   "http://localhost:8000/api/export?path=/tmp/demo.db&format=sql"
curl -o schema.png   "http://localhost:8000/api/export?path=/tmp/demo.db&format=png"
curl -o schema.pdf   "http://localhost:8000/api/export?path=/tmp/demo.db&format=pdf"
```

---

## Error Handling

API errors use FastAPI's standard structure with HTTP status codes:

```json
{
  "detail": "Database not open"
}
```

Common status codes:

- `400` — invalid request (bad action, unsupported export format, invalid identifier, etc.).
- `404` — resource not found (database not open, path/history entry missing).

The frontend `lib/api.ts` surfaces the `detail` message as the thrown `Error`.
