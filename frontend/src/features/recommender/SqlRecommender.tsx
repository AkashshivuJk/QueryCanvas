import { useMemo, useState } from "react";
import { Copy, Play, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useQueryStore } from "@/store/useQueryStore";
import { useRecommendations, useExecuteQuery } from "@/hooks/useDatabase";
import type { Recommendation, RecommendationCategory } from "@/types";

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  overview: "Overview",
  data_quality: "Data Quality",
  performance: "Performance",
  relationships: "Relationships",
  examples: "Examples",
};

const CATEGORY_ORDER: RecommendationCategory[] = [
  "overview",
  "data_quality",
  "performance",
  "relationships",
  "examples",
];

export function SqlRecommender() {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const setCurrentSql = useQueryStore((s) => s.setCurrentSql);
  const setResults = useQueryStore((s) => s.setResults);
  const setIsExecuting = useQueryStore((s) => s.setIsExecuting);
  const setLastError = useQueryStore((s) => s.setLastError);

  const recsQuery = useRecommendations(activeDbPath);
  const execMut = useExecuteQuery();
  const [filter, setFilter] = useState("");

  const grouped = useMemo(() => {
    const all = recsQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q ? all.filter((r) => r.title.toLowerCase().includes(q)) : all;
    const map = new Map<RecommendationCategory, Recommendation[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const r of filtered) {
      const list = map.get(r.category);
      if (list) list.push(r);
    }
    return map;
  }, [recsQuery.data, filter]);

  function copySql(sql: string) {
    navigator.clipboard
      .writeText(sql)
      .then(() => toast.success("SQL copied to clipboard"))
      .catch(() => toast.error("Failed to copy"));
  }

  function runSql(rec: Recommendation) {
    if (!activeDbPath) {
      toast.error("No database selected");
      return;
    }
    setCurrentSql(rec.sql);
    setIsExecuting(true);
    setLastError(null);
    execMut.mutate(
      { path: activeDbPath, sql: rec.sql },
      {
        onSuccess: (res) => {
          setResults(res.results);
          const firstError = res.results.find((r) => !r.success);
          if (firstError) {
            setLastError(firstError.error);
            toast.error(firstError.error || "Query failed");
          } else {
            toast.success("Recommendation executed");
          }
        },
        onError: (e) => {
          const msg = e instanceof Error ? e.message : "Query failed";
          setLastError(msg);
          toast.error(msg);
        },
        onSettled: () => setIsExecuting(false),
      },
    );
  }

  if (recsQuery.isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (recsQuery.isError) {
    return (
      <div className="p-3 text-xs text-destructive">
        Failed to load recommendations: {recsQuery.error instanceof Error ? recsQuery.error.message : "unknown error"}
      </div>
    );
  }

  const totalRecs = recsQuery.data?.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter recommendations by title…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {totalRecs === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-8 w-8 opacity-30" />
            <span>No recommendations available.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[cat]}</Badge>
                    <span className="text-[10px] text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((rec) => (
                      <div key={rec.id} className="rounded-md border border-border bg-card p-2.5">
                        <div className="mb-0.5 text-sm font-semibold">{rec.title}</div>
                        <div className="mb-2 text-xs text-muted-foreground">{rec.description}</div>
                        <pre className="mb-2 max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
                          {rec.sql}
                        </pre>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => copySql(rec.sql)}>
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 gap-1"
                            onClick={() => runSql(rec)}
                            disabled={execMut.isPending}
                          >
                            <Play className="h-3 w-3" /> Run
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}