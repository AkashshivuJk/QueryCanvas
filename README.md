# Database Visualizer & SQL Workspace

A modern, in-browser database IDE for writing and executing SQL, inspecting database structure, visualizing table relationships, and exploring data — all from a single three-panel workspace.

## Features

### SQL Workspace
- CodeMirror-based SQL editor with syntax highlighting and autocompletion
- Run queries with `Ctrl+Enter` and see results inline
- Execution history with timestamps, runtime, statement type, and favorite toggling
- Saved queries per database for quick reuse
- Query explain plan viewer with cost estimation, index usage, and suggestions

### Database Explorer
- Tree view of schemas, tables, views, indexes, constraints, and triggers
- Detailed column inspection (types, nullability, defaults, primary/foreign keys)
- Table previews with row counts

### Visualization
- React Flow (`@xyflow/react`) schema visualization with draggable table nodes
- Relationship graph focused on a selected table's foreign-key connections
- Edge labels (1-to-many) and configurable connector styles (bezier / straight / step)
- Minimap, layout auto-arrangement, and fullscreen-friendly controls

### Query Execution
- Typed, validated SQL execution against SQLite (stdlib `sqlite3`)
- Result grids with affected-row counts and execution timing
- Cell-level in-place editing of table data

### Undo / Redo
- Full undo/redo for schema-changing statements (`CREATE`, `DROP`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`, indexes)
- Inverse SQL generated automatically per statement type

### History
- Persistent execution history (per database, in-memory, capped at 200 records)
- Star favorite entries and replay any past query

### SQL Recommender
- Schema-driven recommendations across five categories: overview, data quality, performance, relationships, examples
- One-click ready-to-run SQL suggestions

### Query Explainer
- `EXPLAIN QUERY PLAN` rendering with scan detection, index usage, estimated cost, and potential problems

### Table Data Viewer
- Paginated, sortable, searchable table data with row counts

### Import / Export
- Export the full schema to JSON, SQL, SVG, PNG, or PDF (pure-Python generation)
- Import dialogs for bringing data into the workspace

### Search
- Global search across tables and columns (`Ctrl+K`)

### Settings
- Theme (dark / light), grid size, connector style, animation speed, autosave, minimap and column toggles

### Performance
- Result rows capped at 1000 for safety, paginated row fetching with limits

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, Vite, TypeScript (strict), TailwindCSS, shadcn-style UI primitives, React Flow (`@xyflow/react` v12), TanStack Query v5, Zustand, Framer Motion, CodeMirror |
| **Backend** | Python 3.10+, FastAPI, stdlib `sqlite3` (no ORM) |
| **Database** | SQLite (default) — architecture supports Postgres / MySQL / MariaDB via an engine factory |

## Screenshots

> Add screenshots here

## Project Structure

```
project1/
├── backend/
│   ├── main.py                  # FastAPI app: CORS, router mounting, SPA serving
│   ├── config.py                # Host/port and path helpers
│   ├── models.py                # Pydantic v2 request/response models
│   ├── requirements.txt
│   ├── smoke_test.py            # End-to-end API smoke test
│   ├── db/
│   │   ├── engine.py            # DatabaseEngineBase, SQLiteEngine, get_engine factory
│   │   ├── manager.py           # DatabaseManager registry of open engines
│   │   └── undo.py              # UndoRedoManager + execution history
│   ├── routers/
│   │   ├── databases.py         # Lifecycle, metadata, rows, cells
│   │   ├── query.py             # Query execution + explain
│   │   ├── history.py           # History, undo/redo, favorites, replay, saved queries
│   │   ├── recommendations.py   # SQL recommendations
│   │   └── export.py            # JSON / SQL / SVG / PNG / PDF export
│   ├── services/
│   │   ├── recommender.py       # Schema-driven SQL recommendations
│   │   └── explainer.py         # Query plan analysis + suggestions
│   └── utils/
│       ├── sql_parser.py        # Statement classification + inverse generation
│       └── export.py            # Pure-Python PNG/SVG/PDF/JSON/SQL generation
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts           # Dev server, /api proxy, @ alias
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── layout/              # WorkspaceShell, TopBar, StatusBar, PanelSlots
│       ├── features/            # sql, explorer, visualization, data, recommender,
│       │                        #   search, settings, import-export
│       ├── components/ui/       # Hand-rolled shadcn-style primitives
│       ├── store/               # Zustand stores (database, query, settings, UI)
│       ├── hooks/               # useDatabase.ts, useKeyboardShortcuts.ts, useTheme.ts
│       ├── lib/                 # api.ts, constants.ts, utils.ts
│       ├── providers/           # QueryProvider, ThemeProvider
│       └── types/index.ts       # Typed API contract
├── shared/
│   └── types.ts                 # Re-exported shared type contract
└── docs/
    ├── ARCHITECTURE.md          # System and component architecture
    └── API.md                   # Full API reference
```

## Prerequisites

- **Node.js 18+** (Node 18 or newer)
- **npm**
- **Python 3.10+**

## Installation & Setup

### Backend

```bash
cd backend
pip3 install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
```

## Running the App

### Start the backend

From the project root:

```bash
python3 -m uvicorn backend.main:app --port 8000
```

Or from the `backend/` directory:

```bash
cd backend && python3 main.py
```

The API is served at `http://localhost:8000` (the host/port can be overridden with the `HOST` and `PORT` environment variables).

### Start the frontend (development)

```bash
cd frontend
npm run dev
```

Opens the app at `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://127.0.0.1:8000`.

### Production

Build the frontend:

```bash
cd frontend
npm run build
```

Then start the backend. When a built `frontend/dist/` directory exists, FastAPI serves the SPA and static assets, so the app is available at `http://localhost:8000`.

## API Reference

All endpoints are mounted under `/api`. See [docs/API.md](docs/API.md) for the full reference with request/response examples and `curl` snippets.

| Method | Path | Description | Key params |
| --- | --- | --- | --- |
| `GET` | `/api/databases` | List open databases | — |
| `POST` | `/api/databases` | Create or open a database | body: `path`, `action` (`create`/`open`), `name?` |
| `DELETE` | `/api/databases` | Close a database | `path` |
| `GET` | `/api/databases/metadata` | Full schema metadata | `path` |
| `GET` | `/api/databases/tables/rows` | Fetch table rows | `path`, `table`, `limit?`, `offset?`, `sort?`, `dir?`, `search?` |
| `POST` | `/api/databases/cells` | Edit a cell value | body: `path`, `table`, `rowid`, `column`, `value` |
| `POST` | `/api/query` | Execute a SQL statement | body: `path`, `sql` |
| `POST` | `/api/explain` | Explain a query plan | body: `path`, `sql` |
| `GET` | `/api/history` | Execution history + undo/redo stacks | `path` |
| `POST` | `/api/history/undo` | Undo last schema change | `path` |
| `POST` | `/api/history/redo` | Redo last undone change | `path` |
| `POST` | `/api/history/favorite` | Toggle favorite on a history entry | body: `path`, `history_id`, `favorite` |
| `POST` | `/api/history/replay` | Re-run a history entry | `path`, `history_id` |
| `GET` | `/api/saved-queries` | List saved queries | `path` |
| `POST` | `/api/saved-queries` | Create a saved query | body: `path`, `name`, `sql` |
| `DELETE` | `/api/saved-queries` | Delete a saved query | `path`, `id` |
| `GET` | `/api/recommendations` | Schema-driven SQL recommendations | `path` |
| `GET` | `/api/export` | Export schema/data | `path`, `format` (`json`/`sql`/`svg`/`png`/`pdf`) |

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Enter` | Run the current query |
| `Ctrl+Z` | Undo last schema change |
| `Ctrl+Shift+Z` | Redo last undone change |
| `Ctrl+S` | Save the current query |
| `Ctrl+K` | Open global search |
| `Ctrl+B` | Toggle the database explorer |

> `Ctrl` works as `Cmd` on macOS.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for an in-depth discussion of the layered frontend/backend design, undo/redo mechanics, query execution flow, schema introspection, and data flow.

### Frontend layers

1. **Presentation** — `layout/` (`WorkspaceShell`, `TopBar`, `StatusBar`) and per-area `features/` (sql, explorer, visualization, data, recommender, search, settings, import-export).
2. **State management** — Zustand stores (`useDatabaseStore`, `useQueryStore`, `useSettingsStore`, `useUIStore`).
3. **Data fetching & caching** — TanStack Query hooks in `hooks/useDatabase.ts` with typed query keys and invalidation on `schema_changed`.
4. **UI primitives** — hand-rolled shadcn-style components in `components/ui/`.
5. **API client** — `lib/api.ts`, a typed `fetch` wrapper.
6. **Types** — `types/index.ts` mirrors `backend/models.py` and is re-exported from `shared/types.ts`.

### Backend layers

1. **`main.py`** — FastAPI app: CORS, router mounting, SPA serving.
2. **`routers/`** — `databases`, `query`, `history`, `recommendations`, `export`.
3. **`db/`** — `engine.py` (`DatabaseEngineBase` + `SQLiteEngine` + `get_engine` factory), `manager.py` (engine registry), `undo.py` (undo/redo + history).
4. **`services/`** — `recommender.py`, `explainer.py`.
5. **`utils/`** — `sql_parser.py` (classify + inverse generation), `export.py` (pure-Python PNG/SVG/PDF/JSON/SQL).

### Data flow

The user writes SQL in the editor; on execution the request goes to the backend, which classifies the statement, captures an inverse (for schema-changing statements), executes it against SQLite, records history + undo state, and returns a `QueryResult`. If the schema changed, the frontend invalidates the metadata/history/recommendations/rows caches, so the explorer tree and visualization auto-refresh.

## Database Engine Extensibility

The backend is built around an engine abstraction so additional databases can be added without changing the API or routers.

- `backend/db/engine.py` defines `DatabaseEngineBase`, an abstract contract with lifecycle (`close`), introspection (`metadata`, `row_count`, `rows`), and execution (`execute`, `explain`, `update_cell`).
- `SQLiteEngine` is the concrete default, backed by stdlib `sqlite3`.
- `get_engine(backend, path)` is the factory that maps a backend name to a concrete engine.
- `PostgresEngine` and `MySQLEngine` placeholders document the extension seam.

**To add Postgres or MySQL:**

1. Create a subclass of `DatabaseEngineBase` (e.g. `PostgresEngine`) implementing `close`, `metadata`, `row_count`, `rows`, `execute`, `explain`, and `update_cell` using the relevant driver (`psycopg`/`asyncpg` or `PyMySQL`/`mysql-connector`).
2. Accept connection parameters (host/port/user/dbname) where the current constructor takes a filesystem `path` — add them to `backend/config.py`.
3. Register the new backend name in `get_engine()`.

The routers and API contract remain unchanged because they operate against `DatabaseEngineBase`.

## Testing

Run the end-to-end API smoke test from the project root:

```bash
python3 backend/smoke_test.py
```

The smoke test uses a temporary SQLite file and exercises all major endpoints via FastAPI's `TestClient`.

## License

This project is licensed under the MIT License.
