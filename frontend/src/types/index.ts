// Type definitions matching the backend API models exactly.

export type BackendType = "sqlite" | "postgres" | "mysql" | "mariadb";

export type StatementType =
  | "SELECT"
  | "DDL"
  | "DML"
  | "UNKNOWN";

export type JsonValue = string | number | boolean | null;

// --- Databases -------------------------------------------------------------

export interface DatabaseInfo {
  path: string;
  name: string;
  size_bytes: number;
  backend: BackendType;
}

export interface DatabaseCreateRequest {
  action: "create" | "open";
  path?: string;
  name?: string;
}

export interface CellEditRequest {
  path: string;
  table: string;
  rowid: number;
  column: string;
  value: JsonValue;
}

// --- Metadata --------------------------------------------------------------

export interface ForeignKeyReference {
  table: string;
  column: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string | null;
  is_pk: boolean;
  is_fk: boolean;
  fk_references: ForeignKeyReference[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ConstraintInfo {
  name: string;
  type: string;
  columns: string[];
  definition: string;
}

export interface TriggerInfo {
  name: string;
  event: string;
  timing: string;
  statement: string;
}

export interface ForeignKey {
  name: string;
  from_column: string;
  to_table: string;
  to_column: string;
}

export interface TableInfo {
  name: string;
  type: "table" | "view";
  row_count: number;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  triggers: TriggerInfo[];
  foreign_keys: ForeignKey[];
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
}

export interface Metadata {
  database: string;
  schemas: SchemaInfo[];
  views: string[];
  indexes: string[];
  functions: string[];
  triggers: string[];
}

// --- Query -----------------------------------------------------------------

export interface QueryResult {
  columns: string[];
  rows: JsonValue[][];
  affected_rows: number;
  execution_time_ms: number;
  success: boolean;
  error: string | null;
  statement_type: StatementType;
  schema_changed: boolean;
}

export interface MultiQueryResult {
  results: QueryResult[];
  total: number;
  any_schema_changed: boolean;
}

export interface ExplainPlanRow {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface ExplainResult {
  plan: ExplainPlanRow[];
  estimated_cost: number;
  indexes_used: string[];
  suggestions: string[];
  potential_problems: string[];
}

// --- Rows ------------------------------------------------------------------

export interface RowsResponse {
  columns: string[];
  rows: JsonValue[][];
  total: number;
  limit: number;
  offset: number;
}

// --- History ---------------------------------------------------------------

export interface HistoryEntry {
  id: string;
  sql: string;
  timestamp: string;
  execution_time_ms: number;
  affected_rows: number;
  success: boolean;
  error: string | null;
  favorite: boolean;
  statement_type: StatementType;
}

export interface UndoRedoEntry {
  sql: string;
  inverse_sql: string;
  timestamp: string;
  op_type: string;
}

export interface HistoryResponse {
  execution: HistoryEntry[];
  undo_stack: UndoRedoEntry[];
  redo_stack: UndoRedoEntry[];
}

export interface UndoRedoResult {
  success: boolean;
  sql_executed: string;
  metadata_changed: boolean;
  error: string | null;
}

// --- Saved Queries ---------------------------------------------------------

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  created_at: string;
}

// --- Recommendations -------------------------------------------------------

export type RecommendationCategory =
  | "overview"
  | "data_quality"
  | "performance"
  | "relationships"
  | "examples";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  sql: string;
  category: RecommendationCategory;
}