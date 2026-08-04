# Architecture

This document describes the system architecture of the **Database Visualizer & SQL Workspace**. It covers the overall topology, the layered frontend and backend designs, the undo/redo model, query execution flow, schema introspection, data flow, and how to extend the backend to additional database engines.

## System Overview

The application is a classic client–server split:

- A **React SPA** (Vite + TypeScript) provides the three-panel IDE, talks to the backend exclusively over a JSON API (`/api/*`), and manages UI state and server-cache invalidation locally.
- A **FastAPI** backend owns all database access. It validates and executes SQL against **SQLite** (via stdlib `sqlite3`), captures undo/redo state, records execution history, and generates schema metadata, recommendations, explain plans, and exports.
- **SQLite** is the default and only fully implemented engine. The architecture is designed so that Postgres / MySQL / MariaDB can be added through an engine factory without touching the routers.

```
┌────────────────────────────┐         ┌─────────────────────────────┐         ┌────────────┐
│        Frontend (SPA)      │         │          Backend            │         │  Database  │
│                            │  JSON   │                             │  SQL    │            │
│  SQL Workspace · Explorer  │ ──────► │   FastAPI (routers)         │ ──────► │   SQLite   │
│  Visualization · Data      │  /api/* │   db/ (engine, manager,     │         │  (sqlite3) │
│  Recommender · Search      │ ◄────── │        undo)                │ ◄────── │            │
│                            │         │   services/ · utils/        │         │            │
└────────────────────────────┘         └─────────────────────────────┘         └────────────┘
```

Both dev and production are served by one backend: in development Vite proxies `/api` to FastAPI, while in production FastAPI serves the built SPA from `frontend/dist/`.

## Frontend Architecture

The frontend is organized into four cooperating layers: presentation components, Zustand state, TanStack Query data fetching, and typed API/types. A set of hand-rolled UI primitives underpins the presentation layer.

### Presentation

- **`layout/`** — the application shell and chrome:
  - `WorkspaceShell.tsx` — three-column responsive layout (SQL workspace · database explorer · right visualization panel), wired through `PanelSlots.tsx`.
  - `TopBar.tsx` — title, database selector, and global actions.
  - `StatusBar.tsx` — connection/status feedback.
- **`features/`** — feature-specific panels and dialogs, grouped by domain:
  - `sql/` — `SqlWorkspace`, `SqlEditor` (CodeMirror), `QueryResults`, `QueryHistory`, `SavedQueries`, `QueryExplain`, and `formatter.ts`.
  - `explorer/` — `DatabaseExplorer`, `ExplorerTree`, `TableDetails`.
  - `visualization/` — `SchemaVisualization`, `RelationshipGraph`, `RightPanel`, `TableNode`, `LabeledEdge`, `VisualizationToolbar`, plus `buildGraph.ts` and `autoLayout.ts` helpers.
  - `data/` — `TableDataViewer`.
  - `recommender/` — `SqlRecommender`.
  - `search/` — `GlobalSearch`.
  - `settings/` — `SettingsDialog`.
  - `import-export/` — `ImportDialog`, `ExportDialog`.
  - `GlobalDialogs.tsx` — hosts the search / settings / import / export dialogs app-wide.

### State management (Zustand)

- **`useDatabaseStore`** — the active connection and its metadata: `activeDbPath`, `databases`, `metadata`, with `setDatabases`, `setActive`, `setMetadata`. `setActive` clears metadata so it is re-fetched for the newly selected database.
- **`useQueryStore`** — the current editor and result state: `currentSql`, `results`, `isExecuting`, `lastError`, and their setters.
- **`useSettingsStore`** — persisted user preferences (`theme`, `gridSize`, `connectorStyle`, `animationSpeed`, `autosave`, `showMinimap`, `showColumns`) with a setter per field; persisted to `localStorage` under `dvws-settings`.
- **`useUIStore`** — transient UI state: `selectedTableName`, `rightTab` (`visualization` | `graph`), `explorerVisible`, dialog flags (`globalSearchOpen`, `settingsOpen`, `importOpen`, `exportOpen`), and `highlightTable`.

### Data fetching (TanStack Query)

- Hooks live in `hooks/useDatabase.ts` and the query keys in `lib/constants.ts`.
- **Query keys** are typed tuples, e.g. `["metadata", path]`, `["rows", path, table]`, `["history", path]`, `["recommendations", path]`, `["saved-queries", path]`, `["databases"]`.
- **Mutations** (`useExecuteQuery`, `useUndo`, `useRedo`, `useEditCell`, `useToggleFavorite`, `useSaveQuery`, `useDeleteSavedQuery`) invalidate the relevant caches after success.
- **Invalidation strategy** — when a query reports `schema_changed`, `useExecuteQuery` invalidates metadata, history, recommendations, and all rows for that path, so the explorer tree and visualization auto-refresh. Undo/redo invalidate the same set. Cell edits invalidate only the affected table's rows.

### UI primitives

- `components/ui/` contains hand-rolled, shadcn-style primitives: `badge`, `button`, `context-menu`, `dialog`, `dropdown-menu`, `input`, `scroll-area`, `select`, `separator`, `skeleton`, `switch`, `tabs`, `textarea`, `toast`, `tooltip`.
- Styling is TailwindCSS (`tailwind.config.js`) with a `cn` helper in `lib/utils.ts`.

### API client

- `lib/api.ts` is a typed `fetch` wrapper. It builds the base URL (`/api` by default, overridable via `VITE_API_BASE`), serializes query strings, throws `Error(detail)` on non-2xx, and returns typed results.
- It exposes functions per resource (`listDatabases`, `createDatabase`, `getMetadata`, `getRows`, `editCell`, `executeQuery`, `explainQuery`, `getHistory`, `undo`, `redo`, `toggleFavorite`, `replayQuery`, `listSavedQueries`, `saveQuery`, `deleteSavedQuery`, `getRecommendations`, `fetchExport`, `exportUrl`).

### Types

- `types/index.ts` mirrors the Pydantic models in `backend/models.py` exactly (see [`docs/API.md`](API.md) for the JSON shapes). It is re-exported from `shared/types.ts` as the canonical shared contract.

## Backend Architecture

The backend is a FastAPI application organized into routers, a database layer, services, and utilities.

### Entry point — `main.py`

- Builds the `FastAPI` app (`create_app()`):
  - **CORS** — `allow_origins=["*"]` for local development.
  - **Router mounting** — `databases`, `query`, `history`, `recommendations`, `export`.
  - **SPA serving** — when `frontend/dist/` exists, serves `/assets` statically and provides an SPA fallback that never shadows `/api` routes; otherwise `GET /` returns an API info JSON.
- `main()` runs uvicorn directly (`HOST` / `PORT` env respected) for `python backend/main.py`.

### Routers — `routers/`

| Router | Endpoints | Responsibility |
| --- | --- | --- |
| `databases.py` | `GET/POST/DELETE /databases`, `GET /databases/metadata`, `GET /databases/tables/rows`, `POST /databases/cells` | Lifecycle (create/open/close), schema metadata, row fetching, cell editing |
| `query.py` | `POST /query`, `POST /explain` | Statement classification, inverse capture, execution, history+undo record, explain plans |
| `history.py` | `GET /history`, `POST /history/undo|redo|favorite|replay`, `GET/POST/DELETE /saved-queries` | Execution history, undo/redo stacks, favorites, replay, per-database saved queries (in-memory) |
| `recommendations.py` | `GET /recommendations` | Schema-driven SQL recommendations |
| `export.py` | `GET /export` | JSON / SQL / SVG / PNG / PDF export |

### Database layer — `db/`

- **`engine.py`** — the engine abstraction:
  - `DatabaseEngineBase` — the abstract contract: `close`, `metadata`, `row_count`, `rows`, `execute`, `explain`, `update_cell`.
  - `SQLiteEngine` — the concrete implementation using stdlib `sqlite3` (foreign keys ON, `check_same_thread=False`).
  - `PostgresEngine` / `MySQLEngine` — documented extension seams (raise `NotImplementedError`).
  - `get_engine(backend, path)` — factory dispatch on backend name.
  - `db_size(path)` — file size helper.
- **`manager.py`** — `DatabaseManager`, an in-memory registry of open engines keyed by absolute path. Handles `create`/`open`/`close`/`get`/`contains`/`list` and normalizes paths. Used as a singleton via `get_manager()`.
- **`undo.py`** — `UndoRedoManager`: maintains the undo stack, redo stack, and capped execution history (`MAX_HISTORY = 200`) per database path (`get_undo_manager(path)`).

### Services — `services/`

- **`recommender.py`** — `generate_recommendations(metadata)` produces SQL suggestions across five categories: `overview`, `data_quality`, `performance`, `relationships`, `examples`.
- **`explainer.py`** — `explain(plan_rows, sql)` parses `EXPLAIN QUERY PLAN` output, detects full scans, extracts index usage, and builds `estimated_cost`, `suggestions`, and `potential_problems`.

### Utilities — `utils/`

- **`sql_parser.py`** — `classify(sql)` → `(statement_type, schema_changed)` where type is `SELECT`/`DDL`/`DML`/`UNKNOWN`; and `generate_inverse(connection, sql)` / `inverse_for_insert(...)` which produce inverse statements for undo/redo.
- **`export.py`** — pure-Python generators for JSON, SQL, SVG, PNG (hand-rolled PNG encoder), and PDF (hand-rolled encoder), with no external binary dependencies.

## Undo / Redo Design

Undo/redo is driven by **inverse SQL generation**. The parser (`utils/sql_parser.py`) produces the inverse *before* execution for destructive statements (so the pre-change state can be captured) and *after* execution for inserts (using `last_insert_rowid`).

| Operation analyzed | `op_type` | Inverse generated |
| --- | --- | --- |
| `CREATE TABLE` | `CREATE_TABLE` | `DROP TABLE IF EXISTS <table>` |
| `DROP TABLE` | `DROP_TABLE` | Re-creates the table from the captured `CREATE` in `sqlite_master` |
| `CREATE INDEX` | `CREATE_INDEX` | `DROP INDEX IF EXISTS <index>` |
| `DROP INDEX` | `DROP_INDEX` | Re-creates the index from the captured `CREATE INDEX` |
| `ALTER TABLE ... ADD COLUMN` | `ALTER_TABLE` | `DROP COLUMN` when SQLite ≥ 3.35, otherwise a commented manual-recreate hint |
| `ALTER TABLE ... DROP COLUMN` | `ALTER_TABLE` | Comment noting manual restore |
| `ALTER TABLE ... RENAME` | `ALTER_TABLE` | Reverse `RENAME TO` |
| `INSERT` | `INSERT` | `DELETE FROM <table> WHERE rowid = last_insert_rowid()` |
| `UPDATE` | `UPDATE` | Per-row `UPDATE ... SET <original values> WHERE rowid = N` (parameterized via `-- params:` comment) |
| `DELETE` | `DELETE` | Per-row re-insert `INSERT INTO ... VALUES (...)` (parameterized via `-- params:` comment) |

Key behaviors in `UndoRedoManager`:

- On **undo**, the inverse SQL is executed; the entry is moved to the redo stack; a new schema-changing action clears the redo stack.
- On **redo**, the original SQL is executed and the entry is moved back to the undo stack.
- Parameterized inverses (UPDATE/DELETE) embed bound values in a `-- params:` comment that the undo router splits and executes via `executescript`.
- A failed undo/redo is rolled back into its originating stack.
- History is independent of undo: every executed statement is recorded (with runtime, affected rows, success, statement type), and entries can be favorited or replayed.

## Query Execution Flow

The `POST /query` route (`_execute_with_tracking`) implements the following pipeline:

1. **Classify** — `classify(sql)` returns `(statement_type, schema_changed)`.
2. **Capture inverse (if schema-changing)** — for `DROP`/`UPDATE`/`DELETE`/`ALTER`, `generate_inverse` is called *before* execution to snapshot current state.
3. **Execute** — `SELECT` runs through `execute_select` (capped at 1000 rows); other statements run through `execute`, recording `rowcount`. For `INSERT`, the rowid-based inverse is generated after execution.
4. **Record history** — the execution is appended to the history (`add_history`) with timing and outcome.
5. **Push to undo stack** — only when the schema changed *and* execution succeeded (`capture_undo`).
6. **Return** — a `QueryResult` payload (`columns`, `rows`, `affected_rows`, `execution_time_ms`, `success`, `error`, `statement_type`, `schema_changed`).

**Frontend side**: on success with `schema_changed === true`, `useExecuteQuery` invalidates the metadata/history/recommendations/rows caches, which triggers automatic refresh of the explorer tree and the React Flow visualization.

## Schema Introspection

The SQLite engine builds its metadata via standard PRAGMA / catalog queries:

- `PRAGMA table_info(<table>)` — columns, types, nullability, defaults, primary keys.
- `PRAGMA foreign_key_list(<table>)` — foreign-key relationships and references.
- `PRAGMA index_list(<table>)` + `PRAGMA index_info(<index>)` — indexes and their columns.
- `sqlite_master` — table/view/index/trigger names and their original `CREATE` SQL.

These are composed into the `Metadata` structure: a `database` name, a single `main` schema containing `tables` and `views`, each with `columns`, `indexes`, `constraints`, `triggers`, and `foreign_keys`, plus top-level `indexes` and `triggers` lists.

## Data Flow (end-to-end)

```
User edits SQL in CodeMirror editor (SqlEditor)
        │  (setCurrentSql)
        ▼
useExecuteQuery mutation ──► api.executeQuery(path, sql)
        │                      POST /api/query  { path, sql }
        ▼
FastAPI router  /query
        │  classify(sql)
        │  generate_inverse(sql)            (if schema-changing)
        │  execute against SQLite
        │  add_history + capture_undo
        ▼
QueryResult  ◄── JSON response
        │
        ▼
useQueryStore.setResults ──► QueryResults grid renders
        │
        └─ if schema_changed: invalidate metadata/history/recommendations/rows
                │
                ▼
        useMetadata re-fetches ──► useDatabaseStore.setMetadata
                │
                ├─► DatabaseExplorer tree re-renders
                └─► SchemaVisualization / RelationshipGraph auto-refresh
```

## Extensibility: Adding a New Database Backend

Adding Postgres or MySQL follows the engine pattern:

1. **Implement the engine** — subclass `DatabaseEngineBase` and implement `close`, `metadata`, `row_count`, `rows`, `execute`, `explain`, and `update_cell` using the appropriate driver. The abstract class in `backend/db/engine.py` documents the exact contract.
2. **Connection parameters** — replace the filesystem `path` with a connection config (host/port/user/dbname) sourced from `backend/config.py`.
3. **Register the factory** — add the backend name to `get_engine(backend, path)` so `DatabaseManager` can construct it.

Because routers depend only on `DatabaseEngineBase`, the API surface and frontend are unaffected by adding an engine.
