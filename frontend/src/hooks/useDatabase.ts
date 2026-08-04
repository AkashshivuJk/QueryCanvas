import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import type { CellEditRequest } from "@/types";
import type { RowsOptions } from "@/lib/api";

// --- Databases -------------------------------------------------------------

export function useDatabases() {
  return useQuery({
    queryKey: QUERY_KEYS.databases,
    queryFn: api.listDatabases,
  });
}

export function useMetadata(activePath: string | null) {
  return useQuery({
    queryKey: activePath ? QUERY_KEYS.metadata(activePath) : ["metadata", "none"],
    queryFn: () => api.getMetadata(activePath!),
    enabled: !!activePath,
  });
}

// --- Rows ------------------------------------------------------------------

export function useRows(path: string | null, table: string | null, opts: RowsOptions = {}) {
  return useQuery({
    queryKey: path && table ? QUERY_KEYS.rows(path, table) : ["rows", "none"],
    queryFn: () => api.getRows(path!, table!, opts),
    enabled: !!path && !!table,
  });
}

// --- Query -----------------------------------------------------------------

export function useExecuteQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, sql }: { path: string; sql: string }) =>
      api.executeQuery(path, sql),
    onSuccess: (result, vars) => {
      if (result.any_schema_changed && vars.path) {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.metadata(vars.path) });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.history(vars.path) });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.recommendations(vars.path) });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.rows(vars.path, "") });
      }
    },
  });
}

export function useExplain() {
  return useMutation({
    mutationFn: ({ path, sql }: { path: string; sql: string }) =>
      api.explainQuery(path, sql),
  });
}

// --- Cells -----------------------------------------------------------------

export function useEditCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CellEditRequest) => api.editCell(req),
    onSuccess: (_data, req) => {
      if (req.path && req.table) {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.rows(req.path, req.table) });
      }
    },
  });
}

// --- History ---------------------------------------------------------------

export function useHistory(path: string | null) {
  return useQuery({
    queryKey: path ? QUERY_KEYS.history(path) : ["history", "none"],
    queryFn: () => api.getHistory(path!),
    enabled: !!path,
  });
}

export function useUndo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.undo(path),
    onSuccess: (_data, path) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.metadata(path) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.history(path) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.recommendations(path) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.rows(path, "") });
    },
  });
}

export function useRedo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.redo(path),
    onSuccess: (_data, path) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.metadata(path) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.history(path) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.recommendations(path) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.rows(path, "") });
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, historyId, favorite }: { path: string; historyId: string; favorite: boolean }) =>
      api.toggleFavorite(path, historyId, favorite),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.history(vars.path) });
    },
  });
}

export function useReplayQuery() {
  return useMutation({
    mutationFn: ({ path, historyId }: { path: string; historyId: string }) =>
      api.replayQuery(path, historyId),
  });
}

// --- Saved Queries ---------------------------------------------------------

export function useSavedQueries(path: string | null) {
  return useQuery({
    queryKey: path ? QUERY_KEYS.savedQueries(path) : ["saved-queries", "none"],
    queryFn: () => api.listSavedQueries(path!),
    enabled: !!path,
  });
}

export function useSaveQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, name, sql }: { path: string; name: string; sql: string }) =>
      api.saveQuery(path, name, sql),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.savedQueries(vars.path) });
    },
  });
}

export function useDeleteSavedQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, id }: { path: string; id: string }) =>
      api.deleteSavedQuery(path, id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.savedQueries(vars.path) });
    },
  });
}

// --- Recommendations -------------------------------------------------------

export function useRecommendations(path: string | null) {
  return useQuery({
    queryKey: path ? QUERY_KEYS.recommendations(path) : ["recommendations", "none"],
    queryFn: () => api.getRecommendations(path!),
    enabled: !!path,
  });
}