import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";
export type GridSize = "compact" | "comfortable";
export type ConnectorStyle = "bezier" | "straight" | "step";
export type AnimationSpeed = "fast" | "normal" | "slow";

interface SettingsState {
  theme: Theme;
  gridSize: GridSize;
  connectorStyle: ConnectorStyle;
  animationSpeed: AnimationSpeed;
  autosave: boolean;
  showMinimap: boolean;
  showColumns: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setGridSize: (g: GridSize) => void;
  setConnectorStyle: (c: ConnectorStyle) => void;
  setAnimationSpeed: (s: AnimationSpeed) => void;
  setAutosave: (v: boolean) => void;
  setShowMinimap: (v: boolean) => void;
  setShowColumns: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      gridSize: "comfortable",
      connectorStyle: "bezier",
      animationSpeed: "normal",
      autosave: false,
      showMinimap: true,
      showColumns: true,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setGridSize: (gridSize) => set({ gridSize }),
      setConnectorStyle: (connectorStyle) => set({ connectorStyle }),
      setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
      setAutosave: (autosave) => set({ autosave }),
      setShowMinimap: (showMinimap) => set({ showMinimap }),
      setShowColumns: (showColumns) => set({ showColumns }),
    }),
    { name: "querycanvas-settings" },
  ),
);