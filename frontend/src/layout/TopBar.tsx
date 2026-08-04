import { Database, Moon, Search, Settings, Sun, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useUIStore } from "@/store/useUIStore";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { databases, activeDbPath, setActive } = useDatabaseStore();
  const {
    setGlobalSearchOpen,
    setSettingsOpen,
    setImportOpen,
    setExportOpen,
  } = useUIStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Database Visualizer
        </span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select
        value={activeDbPath ?? ""}
        onChange={(e) => setActive(e.target.value || null)}
        className={cn("h-8 max-w-[200px] text-xs")}
      >
        <option value="" disabled>
          Select database…
        </option>
        {databases.map((db) => (
          <option key={db.path} value={db.path}>
            {db.name}
          </option>
        ))}
      </Select>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setGlobalSearchOpen(true)}
          title="Global Search (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setImportOpen(true)}
          title="Import Database"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExportOpen(true)}
          title="Export"
          disabled={!activeDbPath}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}