import { motion } from "framer-motion";
import { Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSavedQueries, useDeleteSavedQuery } from "@/hooks/useDatabase";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useQueryStore } from "@/store/useQueryStore";
import { formatTimestamp } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { SavedQuery } from "@/types";

function SavedRow({ query }: { query: SavedQuery }) {
  const setCurrentSql = useQueryStore((s) => s.setCurrentSql);
  const delMut = useDeleteSavedQuery();
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);

  function loadSql() {
    setCurrentSql(query.sql);
  }

  function handleDelete() {
    if (!activeDbPath) return;
    if (!window.confirm(`Delete saved query "${query.name}"?`)) return;
    delMut.mutate(
      { path: activeDbPath, id: query.id },
      {
        onSuccess: () => toast.success("Saved query deleted"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
      },
    );
  }

  const preview = query.sql.length > 140 ? query.sql.slice(0, 140) + "…" : query.sql;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className="group cursor-pointer border-b border-border/60 p-2 hover:bg-accent/40"
      onClick={loadSql}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{query.name}</span>
          </div>
          <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{preview}</pre>
          <div className="mt-1 text-[10px] text-muted-foreground">{formatTimestamp(query.created_at)}</div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </motion.div>
  );
}

export function SavedQueries() {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const saved = useSavedQueries(activeDbPath);

  if (!activeDbPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Open a database to view saved queries.
      </div>
    );
  }

  if (saved.isLoading) {
    return (
      <div className="flex h-full flex-col gap-1.5 p-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const queries = saved.data ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-2 py-1.5">
        <span className="text-xs text-muted-foreground">{queries.length} saved</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {queries.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            No saved queries yet. Click Save in the editor toolbar.
          </div>
        ) : (
          queries.map((q) => <SavedRow key={q.id} query={q} />)
        )}
      </ScrollArea>
    </div>
  );
}