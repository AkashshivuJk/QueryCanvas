import type {
  CellEditRequest,
  DatabaseCreateRequest,
  DatabaseInfo,
  ExplainResult,
  HistoryResponse,
  JsonValue,
  Metadata,
  MultiQueryResult,
  QueryResult,
  Recommendation,
  RowsResponse,
  SavedQuery,
  UndoRedoResult,
} from "@/types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

/** Query-string builder for path params. */
function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

/** Generic JSON fetch with error handling. */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => res.statusText);
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// --- Databases -------------------------------------------------------------

export async function listDatabases(): Promise<DatabaseInfo[]> {
  return fetchJson<DatabaseInfo[]>("/databases");
}

export async function createDatabase(req: DatabaseCreateRequest): Promise<DatabaseInfo> {
  return fetchJson<DatabaseInfo>("/databases", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function deleteDatabase(path: string): Promise<void> {
  await fetchJson<{ success: boolean }>(`/databases${qs({ path })}`, { method: "DELETE" });
}

export async function getMetadata(path: string): Promise<Metadata> {
  return fetchJson<Metadata>(`/databases/metadata${qs({ path })}`);
}

// --- Rows ------------------------------------------------------------------

export interface RowsOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  dir?: "asc" | "desc";
  search?: string;
}

export async function getRows(path: string, table: string, opts: RowsOptions = {}): Promise<RowsResponse> {
  return fetchJson<RowsResponse>(
    `/databases/tables/rows${qs({ path, table, ...opts })}`,
  );
}

export async function editCell(req: CellEditRequest): Promise<{ success: boolean; rowid: number }> {
  return fetchJson<{ success: boolean; rowid: number }>("/databases/cells", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// --- Query -----------------------------------------------------------------

export async function executeQuery(path: string, sql: string): Promise<MultiQueryResult> {
  return fetchJson<MultiQueryResult>("/query", {
    method: "POST",
    body: JSON.stringify({ path, sql }),
  });
}

export async function explainQuery(path: string, sql: string): Promise<ExplainResult> {
  return fetchJson<ExplainResult>("/explain", {
    method: "POST",
    body: JSON.stringify({ path, sql }),
  });
}

// --- History ---------------------------------------------------------------

export async function getHistory(path: string): Promise<HistoryResponse> {
  return fetchJson<HistoryResponse>(`/history${qs({ path })}`);
}

export async function undo(path: string): Promise<UndoRedoResult> {
  return fetchJson<UndoRedoResult>(`/history/undo${qs({ path })}`, { method: "POST" });
}

export async function redo(path: string): Promise<UndoRedoResult> {
  return fetchJson<UndoRedoResult>(`/history/redo${qs({ path })}`, { method: "POST" });
}

export async function toggleFavorite(path: string, historyId: string, favorite: boolean): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>("/history/favorite", {
    method: "POST",
    body: JSON.stringify({ path, history_id: historyId, favorite }),
  });
}

export async function replayQuery(path: string, historyId: string): Promise<QueryResult> {
  return fetchJson<QueryResult>(`/history/replay${qs({ path, history_id: historyId })}`, { method: "POST" });
}

// --- Saved Queries ---------------------------------------------------------

export async function listSavedQueries(path: string): Promise<SavedQuery[]> {
  return fetchJson<SavedQuery[]>(`/saved-queries${qs({ path })}`);
}

export async function saveQuery(path: string, name: string, sql: string): Promise<SavedQuery> {
  return fetchJson<SavedQuery>("/saved-queries", {
    method: "POST",
    body: JSON.stringify({ path, name, sql }),
  });
}

export async function deleteSavedQuery(path: string, id: string): Promise<void> {
  await fetchJson<{ success: boolean }>(`/saved-queries${qs({ path, id })}`, { method: "DELETE" });
}

// --- Recommendations -------------------------------------------------------

export async function getRecommendations(path: string): Promise<Recommendation[]> {
  return fetchJson<Recommendation[]>(`/recommendations${qs({ path })}`);
}

// --- Export ----------------------------------------------------------------

export function exportUrl(path: string, format: "json" | "sql" | "svg" | "png" | "pdf"): string {
  return `${BASE}/export${qs({ path, format })}`;
}

/** Fetch an export as a Blob (for file downloads). */
export async function fetchExport(path: string, format: "json" | "sql" | "svg" | "png" | "pdf"): Promise<Blob> {
  const res = await fetch(exportUrl(path, format));
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}

/** Unused type re-export guard to keep JsonValue in type graph. */
export type { JsonValue };