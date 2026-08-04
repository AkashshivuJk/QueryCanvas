/**
 * Shared type contract between the frontend and backend.
 *
 * These types mirror the Pydantic models declared in `backend/models.py` and
 * document the exact JSON shape of every API request and response.
 *
 * The canonical definitions live in `frontend/src/types/index.ts` (imported by
 * the app through the `@/types` alias). This file re-exports them so that any
 * tooling can consume the shared API contract from a stable,
 * framework-agnostic location. It is a pure type-level contract and emits no
 * runtime code.
 *
 * If a field is added to a backend Pydantic model, update
 * `frontend/src/types/index.ts` and the change flows through automatically.
 */
export type {
  // --- Databases ---
  BackendType,
  StatementType,
  JsonValue,
  DatabaseInfo,
  DatabaseCreateRequest,
  CellEditRequest,

  // --- Metadata ---
  ForeignKeyReference,
  ColumnInfo,
  IndexInfo,
  ConstraintInfo,
  TriggerInfo,
  ForeignKey,
  TableInfo,
  SchemaInfo,
  Metadata,

  // --- Query / Explain ---
  QueryResult,
  ExplainPlanRow,
  ExplainResult,

  // --- Rows ---
  RowsResponse,

  // --- History / Undo / Redo / Saved Queries ---
  HistoryEntry,
  UndoRedoEntry,
  HistoryResponse,
  UndoRedoResult,
  SavedQuery,

  // --- Recommendations ---
  RecommendationCategory,
  Recommendation,
} from "../frontend/src/types";
