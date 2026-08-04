export const KEYBOARD_SHORTCUTS = {
  RUN_QUERY: "Ctrl+Enter",
  UNDO: "Ctrl+Z",
  REDO: "Ctrl+Shift+Z",
  SAVE_QUERY: "Ctrl+S",
  GLOBAL_SEARCH: "Ctrl+K",
  TOGGLE_EXPLORER: "Ctrl+B",
} as const;

export const CONNECTOR_STYLES = {
  bezier: "Bezier",
  straight: "Straight",
  step: "Step",
} as const;

export const DEFAULT_SETTINGS = {
  theme: "dark" as const,
  gridSize: "comfortable" as const,
  connectorStyle: "bezier" as const,
  animationSpeed: "normal" as const,
  autosave: false,
  showMinimap: true,
  showColumns: true,
};

/** Query keys for TanStack Query cache. */
export const QUERY_KEYS = {
  databases: ["databases"] as const,
  metadata: (path: string) => ["metadata", path] as const,
  rows: (path: string, table: string) => ["rows", path, table] as const,
  history: (path: string) => ["history", path] as const,
  recommendations: (path: string) => ["recommendations", path] as const,
  savedQueries: (path: string) => ["saved-queries", path] as const,
};