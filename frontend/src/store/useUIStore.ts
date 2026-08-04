import { create } from "zustand";

export type RightTab = "visualization" | "graph";

interface UIState {
  selectedTableName: string | null;
  setSelectedTable: (name: string | null) => void;
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  explorerVisible: boolean;
  toggleExplorer: () => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  importOpen: boolean;
  setImportOpen: (v: boolean) => void;
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  highlightTable: string | null;
  setHighlightTable: (name: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedTableName: null,
  setSelectedTable: (selectedTableName) => set({ selectedTableName }),
  rightTab: "visualization",
  setRightTab: (rightTab) => set({ rightTab }),
  explorerVisible: true,
  toggleExplorer: () => set({ explorerVisible: !get().explorerVisible }),
  globalSearchOpen: false,
  setGlobalSearchOpen: (globalSearchOpen) => set({ globalSearchOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  importOpen: false,
  setImportOpen: (importOpen) => set({ importOpen }),
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  highlightTable: null,
  setHighlightTable: (highlightTable) => set({ highlightTable }),
}));