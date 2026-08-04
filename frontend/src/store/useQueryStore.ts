import { create } from "zustand";
import type { QueryResult } from "@/types";

interface QueryState {
  currentSql: string;
  setCurrentSql: (sql: string) => void;
  results: QueryResult[];
  currentResultIndex: number;
  setResults: (results: QueryResult[]) => void;
  setCurrentResultIndex: (i: number) => void;
  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;
  lastError: string | null;
  setLastError: (err: string | null) => void;
}

export const useQueryStore = create<QueryState>((set) => ({
  currentSql: "",
  setCurrentSql: (sql) => set({ currentSql: sql }),
  results: [],
  currentResultIndex: 0,
  setResults: (results) => set({ results, currentResultIndex: 0 }),
  setCurrentResultIndex: (currentResultIndex) => set({ currentResultIndex }),
  isExecuting: false,
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
}));