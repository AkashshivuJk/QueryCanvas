import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useQueryStore } from "@/store/useQueryStore";
import { formatDuration } from "@/lib/utils";

export function StatusBar() {
  const { databases, activeDbPath } = useDatabaseStore();
  const isExecuting = useQueryStore((s) => s.isExecuting);
  const results = useQueryStore((s) => s.results);
  const currentResultIndex = useQueryStore((s) => s.currentResultIndex);

  const activeDb = databases.find((d) => d.path === activeDbPath);

  let statusText: string;
  if (isExecuting) {
    statusText = "Executing…";
  } else if (results.length > 0) {
    const safeIndex = currentResultIndex < results.length ? currentResultIndex : 0;
    const current = results[safeIndex];
    const prefix = results.length > 1 ? `Result ${safeIndex + 1} of ${results.length} · ` : "";
    if (current.success) {
      statusText = `${prefix}Success · ${formatDuration(current.execution_time_ms)}`;
    } else {
      statusText = `${prefix}Failed`;
    }
  } else {
    statusText = "Ready";
  }

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-xs text-muted-foreground">
      <span>{activeDb ? activeDb.name : "No database"}</span>
      {activeDb && <span className="text-muted-foreground/60">{activeDb.backend}</span>}
      <span className="ml-auto">{statusText}</span>
    </footer>
  );
}