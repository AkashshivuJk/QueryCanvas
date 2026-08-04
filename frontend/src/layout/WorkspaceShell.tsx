import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TopBar } from "@/layout/TopBar";
import { StatusBar } from "@/layout/StatusBar";
import { SqlWorkspaceSlot, ExplorerSlot, RightPanelSlot } from "@/layout/PanelSlots";
import { cn } from "@/lib/utils";

function ResizeHandle() {
  return (
    <PanelResizeHandle
      className={cn("w-px shrink-0 bg-border transition-colors")}
      style={{ position: "relative" }}
    />
  );
}

export function WorkspaceShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" autoSaveId="dvws-main">
          <Panel defaultSize={25} minSize={15} className="min-w-0">
            <div className="h-full overflow-hidden border-r border-border">
              <SqlWorkspaceSlot />
            </div>
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={35} minSize={15} className="min-w-0">
            <div className="h-full overflow-hidden border-r border-border">
              <ExplorerSlot />
            </div>
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={40} minSize={15} className="min-w-0">
            <div className="h-full overflow-hidden">
              <RightPanelSlot />
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <StatusBar />
    </div>
  );
}