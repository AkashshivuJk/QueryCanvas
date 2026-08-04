import { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";

/** Applies the current theme to the document root and returns theme controls. */
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return { theme, setTheme, toggleTheme };
}