import { Search, Maximize, LayoutGrid, Eye, EyeOff, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useUIStore } from "@/store/useUIStore";
import type { ConnectorStyle } from "@/store/useSettingsStore";

interface Props {
  onFitView: () => void;
  onAutoLayout: () => void;
  highlightRelationships: boolean;
  setHighlightRelationships: (v: boolean) => void;
  searchValue: string;
  onSearch: (v: string) => void;
}

/** Toolbar above the schema visualization canvas. */
export function VisualizationToolbar({
  onFitView,
  onAutoLayout,
  highlightRelationships,
  setHighlightRelationships,
  searchValue,
  onSearch,
}: Props) {
  const connectorStyle = useSettingsStore((s) => s.connectorStyle);
  const setConnectorStyle = useSettingsStore((s) => s.setConnectorStyle);
  const showColumns = useSettingsStore((s) => s.showColumns);
  const setShowColumns = useSettingsStore((s) => s.setShowColumns);
  const highlightTable = useUIStore((s) => s.highlightTable);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-2 py-2">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search tables…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      <Button size="sm" variant="outline" onClick={onFitView} title="Fit view">
        <Maximize className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Fit View</span>
      </Button>

      <Button size="sm" variant="outline" onClick={onAutoLayout} title="Auto layout">
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Auto Layout</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowColumns(!showColumns)}
        title={showColumns ? "Hide columns" : "Show columns"}
      >
        {showColumns ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{showColumns ? "Hide Columns" : "Show Columns"}</span>
      </Button>

      <Button
        size="sm"
        variant={highlightRelationships ? "default" : "outline"}
        onClick={() => setHighlightRelationships(!highlightRelationships)}
        title="Highlight relationships of selected table"
      >
        <GitBranch className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Relationships</span>
      </Button>

      <Select
        value={connectorStyle}
        onChange={(e) => setConnectorStyle(e.target.value as ConnectorStyle)}
        className="h-8 w-[110px] text-xs"
        title="Connector style"
      >
        <option value="bezier">Bezier</option>
        <option value="straight">Straight</option>
        <option value="step">Step</option>
      </Select>

      {highlightTable && (
        <span className="text-xs text-muted-foreground">
          highlighted: <span className="font-medium text-foreground">{highlightTable}</span>
        </span>
      )}
    </div>
  );
}