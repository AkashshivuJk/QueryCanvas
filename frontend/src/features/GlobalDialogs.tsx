import { GlobalSearch } from "@/features/search/GlobalSearch";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { ImportDialog } from "@/features/import-export/ImportDialog";
import { ExportDialog } from "@/features/import-export/ExportDialog";

/**
 * Renders all globally-controlled dialogs driven by useUIStore open flags.
 * Mounted once at the app root so dialogs are always available.
 */
export function GlobalDialogs() {
  return (
    <>
      <GlobalSearch />
      <SettingsDialog />
      <ImportDialog />
      <ExportDialog />
    </>
  );
}