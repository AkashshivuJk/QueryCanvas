import { ExplorerTree } from "@/features/explorer/ExplorerTree";
import { TableDetails } from "@/features/explorer/TableDetails";
import { useUIStore } from "@/store/useUIStore";

export function DatabaseExplorer() {
  const selectedTableName = useUIStore((s) => s.selectedTableName);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <ExplorerTree />
      </div>
      {selectedTableName && (
        <div className="min-h-0 flex-[1.2] border-t border-border">
          <TableDetails />
        </div>
      )}
    </div>
  );
}