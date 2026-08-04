import { create } from "zustand";
import type { DatabaseInfo, Metadata } from "@/types";

interface DatabaseState {
  activeDbPath: string | null;
  databases: DatabaseInfo[];
  metadata: Metadata | null;
  setDatabases: (dbs: DatabaseInfo[]) => void;
  setActive: (path: string | null) => void;
  setMetadata: (meta: Metadata | null) => void;
}

export const useDatabaseStore = create<DatabaseState>((set) => ({
  activeDbPath: null,
  databases: [],
  metadata: null,
  setDatabases: (databases) => set({ databases }),
  setActive: (activeDbPath) => set({ activeDbPath, metadata: null }),
  setMetadata: (metadata) => set({ metadata }),
}));