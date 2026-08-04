import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";

/** Global keyboard shortcuts dispatching custom events + toggling UI state. */
export function useKeyboardShortcuts(): void {
  const setGlobalSearchOpen = useUIStore((s) => s.setGlobalSearchOpen);
  const toggleExplorer = useUIStore((s) => s.toggleExplorer);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Ctrl/Cmd+Shift+Z → Redo
      if (e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dvws:redo"));
        return;
      }

      switch (e.key.toLowerCase()) {
        case "enter":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("dvws:run-query"));
          break;
        case "z":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("dvws:undo"));
          break;
        case "s":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("dvws:save-query"));
          break;
        case "k":
          e.preventDefault();
          setGlobalSearchOpen(true);
          break;
        case "b":
          e.preventDefault();
          toggleExplorer();
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setGlobalSearchOpen, toggleExplorer]);
}