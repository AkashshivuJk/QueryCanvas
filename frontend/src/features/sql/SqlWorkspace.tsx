import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SqlEditor } from "@/features/sql/SqlEditor";
import { QueryResults } from "@/features/sql/QueryResults";
import { QueryHistory } from "@/features/sql/QueryHistory";
import { SavedQueries } from "@/features/sql/SavedQueries";
import { QueryExplain } from "@/features/sql/QueryExplain";
import { SqlRecommender } from "@/features/recommender/SqlRecommender";
import { useQueryStore } from "@/store/useQueryStore";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useExecuteQuery, useExplain, useSaveQuery } from "@/hooks/useDatabase";
import { toast } from "@/components/ui/toast";
import type { ExplainResult } from "@/types";

type Tab = "results" | "history" | "saved" | "explain" | "recommend";

export function SqlWorkspace() {
  const [tab, setTab] = useState<Tab>("results");
  const [explain, setExplain] = useState<ExplainResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const currentSql = useQueryStore((s) => s.currentSql);
  const setResults = useQueryStore((s) => s.setResults);
  const setIsExecuting = useQueryStore((s) => s.setIsExecuting);
  const setLastError = useQueryStore((s) => s.setLastError);

  const execMut = useExecuteQuery();
  const explainMut = useExplain();
  const saveMut = useSaveQuery();

  function handleRun() {
    if (!activeDbPath) {
      toast.error("No database selected");
      return;
    }
    if (!currentSql.trim()) {
      toast.error("Query is empty");
      return;
    }
    setIsExecuting(true);
    setLastError(null);
    setTab("results");
    execMut.mutate(
      { path: activeDbPath, sql: currentSql },
      {
        onSuccess: (res) => {
          setResults(res.results);
          const firstError = res.results.find((r) => !r.success);
          if (firstError) {
            setLastError(firstError.error);
            toast.error(firstError.error || "Query failed");
          } else if (res.any_schema_changed) {
            setLastError(null);
            toast.success("Schema updated");
          } else {
            setLastError(null);
            toast.success(`Executed ${res.total} statement${res.total === 1 ? "" : "s"}`);
          }
        },
        onError: (e) => {
          const msg = e instanceof Error ? e.message : "Query failed";
          setLastError(msg);
          setResults([{
            columns: [],
            rows: [],
            affected_rows: 0,
            execution_time_ms: 0,
            success: false,
            error: msg,
            statement_type: "UNKNOWN",
            schema_changed: false,
          }]);
          toast.error(msg);
        },
        onSettled: () => setIsExecuting(false),
      },
    );
  }

  function handleExplain() {
    if (!activeDbPath) {
      toast.error("No database selected");
      return;
    }
    if (!currentSql.trim()) {
      toast.error("Query is empty");
      return;
    }
    explainMut.mutate(
      { path: activeDbPath, sql: currentSql },
      {
        onSuccess: (res) => {
          setExplain(res);
          setTab("explain");
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Explain failed");
        },
      },
    );
  }

  function handleSaveQuery() {
    if (!currentSql.trim()) {
      toast.error("Query is empty");
      return;
    }
    setSaveName("");
    setSaveOpen(true);
  }

  function confirmSave() {
    if (!activeDbPath) return;
    const name = saveName.trim();
    if (!name) {
      toast.error("Enter a query name");
      return;
    }
    saveMut.mutate(
      { path: activeDbPath, name, sql: currentSql },
      {
        onSuccess: () => {
          toast.success("Query saved");
          setSaveOpen(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
      },
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SqlEditor onRun={handleRun} onExplain={handleExplain} onSaveQuery={handleSaveQuery} />

      <div className="flex min-h-0 flex-1 flex-col border-t border-border">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex h-full min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-2 pt-2">
            <TabsList className="mb-1">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
              <TabsTrigger value="explain">Explain</TabsTrigger>
              <TabsTrigger value="recommend">Recommend</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="results" className="min-h-0 flex-1">
            <QueryResults />
          </TabsContent>
          <TabsContent value="history" className="min-h-0 flex-1">
            <QueryHistory />
          </TabsContent>
          <TabsContent value="saved" className="min-h-0 flex-1">
            <SavedQueries />
          </TabsContent>
          <TabsContent value="explain" className="min-h-0 flex-1">
            <QueryExplain explain={explain} isExplaining={explainMut.isPending} />
          </TabsContent>
          <TabsContent value="recommend" className="min-h-0 flex-1">
            <SqlRecommender />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query</DialogTitle>
            <DialogDescription>Name this query to save it for later reuse.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Query name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSave();
              }}
            />
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 font-mono text-xs text-muted-foreground">
              {currentSql.slice(0, 600)}
              {currentSql.length > 600 ? "…" : ""}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={confirmSave} disabled={saveMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}