import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/store/useUIStore";
import {
  useSettingsStore,
  type AnimationSpeed,
  type ConnectorStyle,
  type GridSize,
  type Theme,
} from "@/store/useSettingsStore";

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog() {
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);

  const {
    theme,
    gridSize,
    connectorStyle,
    animationSpeed,
    autosave,
    showMinimap,
    showColumns,
    setTheme,
    setGridSize,
    setConnectorStyle,
    setAnimationSpeed,
    setAutosave,
    setShowMinimap,
    setShowColumns,
  } = useSettingsStore();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize the workspace appearance and behavior.</DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border">
          <Row label="Theme" description="Light or dark color scheme.">
            <Select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="h-8 w-32 text-xs"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </Row>

          <Row label="Grid Size" description="Density of the visualization grid.">
            <Select
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value as GridSize)}
              className="h-8 w-36 text-xs"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </Row>

          <Row label="Connector Style" description="How relationship edges are drawn.">
            <Select
              value={connectorStyle}
              onChange={(e) => setConnectorStyle(e.target.value as ConnectorStyle)}
              className="h-8 w-36 text-xs"
            >
              <option value="bezier">Bezier</option>
              <option value="straight">Straight</option>
              <option value="step">Step</option>
            </Select>
          </Row>

          <Row label="Animation Speed" description="Transition speed for UI animations.">
            <Select
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(e.target.value as AnimationSpeed)}
              className="h-8 w-32 text-xs"
            >
              <option value="fast">Fast</option>
              <option value="normal">Normal</option>
              <option value="slow">Slow</option>
            </Select>
          </Row>

          <Row label="Autosave" description="Automatically persist query drafts.">
            <Switch checked={autosave} onCheckedChange={setAutosave} />
          </Row>

          <Row label="Show MiniMap" description="Display the graph minimap overlay.">
            <Switch checked={showMinimap} onCheckedChange={setShowMinimap} />
          </Row>

          <Row label="Show Columns" description="Show column lists inside graph table nodes.">
            <Switch checked={showColumns} onCheckedChange={setShowColumns} />
          </Row>
        </div>

        <Separator className="my-1" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}