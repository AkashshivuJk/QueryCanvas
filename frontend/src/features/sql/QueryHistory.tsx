import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useHistory, useToggleFavorite, useReplayQuery } from "@/hooks/useDatabase";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useQueryStore } from "@/store/useQueryStore";
import { formatTimestamp, formatDuration } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { HistoryEntry } from "@/types";

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const setCurrentSql = useQueryStore((s) => s.setCurrentSql);
  const setResults = useQueryStore((s) => s.setResults);
  const setIsExecuting = useQueryStore((s) => s.setIsExecuting);
  const setLastError = useQueryStore((s) => s.setLastError);
  const toggleFav = useToggleFavorite();
  const replay = useReplayQuery();

  function loadSql() {
    setCurrentSql(entry.sql);
  }

  function handleFavorite() {
    if (!activeDbPath) return;
    toggleFav.mutate(
      { path: activeDbPath, historyId: entry.id, favorite: !entry.favorite },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to toggle favorite"),
      },
    );
  }

  function handleReplay() {
    if (!activeDbPath) return;
    setIsExecuting(true);
    replay.mutate(
      { path: activeDbPath, historyId: entry.id },
      {
        onSuccess: (res) => {
          setResults([res]);
          setLastError(res.success ? null : res.error);
        },
        onError: (e) => {
          setLastError(e instanceof Error ? e.message : "Replay failed");
          toast.error(e instanceof Error ? e.message : "Replay failed");
        },
        onSettled: () => setIsExecuting(false),
      },
    );
  }

  const truncated = entry.sql.length > 120 ? entry.sql.slice(0, 120) + "…" : entry.sql;

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
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">{truncated}</pre>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{formatTimestamp(entry.timestamp)}</span>
            <span>·</span>
            <span>{formatDuration(entry.execution_time_ms)}</span>
            <span>·</span>
            <span>{entry.affected_rows} affected</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {entry.success ? (
              <Badge variant="default" className="bg-emerald-600/80 text-[10px]">success</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">error</Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">{entry.statement_type}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); handleFavorite(); }}
            title={entry.favorite ? "Unfavorite" : "Favorite"}
          >
            {entry.favorite ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : <StarOff className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); handleReplay(); }}
            title="Replay"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function QueryHistory() {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const history = useHistory(activeDbPath);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  if (!activeDbPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Open a database to view history.
      </div>
    );
  }

  if (history.isLoading) {
    return (
      <div className="flex h-full flex-col gap-1.5 p-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const entries = history.data?.execution ?? [];
  const filtered = favoritesOnly ? entries.filter((e) => e.favorite) : entries;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Favorites</span>
          <Switch checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
        </label>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {favoritesOnly ? "No favorite queries yet." : "No query history yet."}
          </div>
        ) : (
          filtered.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
        )}
      </ScrollArea>
    </div>
  );
}