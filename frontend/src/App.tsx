import { WorkspaceShell } from "@/layout/WorkspaceShell";
import { GlobalDialogs } from "@/features/GlobalDialogs";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAppInit } from "@/hooks/useAppInit";

export default function App() {
  useKeyboardShortcuts();
  useAppInit();
  return (
    <>
      <WorkspaceShell />
      <GlobalDialogs />
    </>
  );
}