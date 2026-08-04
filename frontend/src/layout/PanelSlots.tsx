import { SqlWorkspace } from "@/features/sql/SqlWorkspace";
import { DatabaseExplorer } from "@/features/explorer/DatabaseExplorer";
import { RightPanel } from "@/features/visualization/RightPanel";

/** Left panel: SQL Workspace. */
export function SqlWorkspaceSlot() {
  return <SqlWorkspace />;
}

/** Center panel: Database Explorer. */
export function ExplorerSlot() {
  return <DatabaseExplorer />;
}

/** Right panel: Visualization & Relationship Graph. */
export function RightPanelSlot() {
  return <RightPanel />;
}