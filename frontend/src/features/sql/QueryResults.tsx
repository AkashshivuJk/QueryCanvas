import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Table2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryStore } from "@/store/useQueryStore";
import { formatDuration, downloadCsv } from "@/lib/utils";
import type { JsonValue, QueryResult } from "@/types";

const MAX_DISPLAY_ROWS = 500;

function JsonCell({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-muted-foreground italic">NULL</span>;
  if (typeof value === "boolean") return <span className="text-sky-400">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-amber-400">{value}</span>;
  return <span>{value}</span>;
}

function ResultBody({ current }: { current: QueryResult }) {
  if (!current.success || current.error) {
    return (
      <div className="flex h-full items-start p-3">
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Query failed</div>
            <div className="mt-1 break-words font-mono text-xs">{current.error}</div>
          </div>
        </div>
      </div>
    );
  }

  // DDL/DML with no columns.
  if (current.columns.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <div className="font-medium">
          Success · {current.affected_rows} row{current.affected_rows === 1 ? "" : "s"} affected · {formatDuration(current.execution_time_ms)}
        </div>
      </div>
    );
  }

  const displayRows = current.rows.slice(0, MAX_DISPLAY_ROWS);
  const truncated = current.rows.length - displayRows.length;

  function handleExport() {
    downloadCsv("query-results.csv", current.columns, current.rows);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="text-xs text-muted-foreground">
          {current.rows.length} row{current.rows.length === 1 ? "" : "s"} · {formatDuration(current.execution_time_ms)}
          {truncated > 0 && <span className="ml-2 text-amber-500">(showing {displayRows.length})</span>}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {current.columns.map((col, i) => (
                <th
                  key={i}
                  className="border-b border-border px-2 py-1.5 text-left font-medium text-foreground whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr key={ri} className="hover:bg-accent/40">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-border/50 px-2 py-1 align-top whitespace-nowrap font-mono">
                    <JsonCell value={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QueryResults() {
  const results = useQueryStore((s) => s.results);
  const currentResultIndex = useQueryStore((s) => s.currentResultIndex);
  const setCurrentResultIndex = useQueryStore((s) => s.setCurrentResultIndex);
  const isExecuting = useQueryStore((s) => s.isExecuting);
  const lastError = useQueryStore((s) => s.lastError);

  if (isExecuting) {
    return (
      <div className="flex h-full flex-col gap-1.5 p-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    );
  }

  if (results.length === 0) {
    if (lastError) {
      return (
        <div className="flex h-full items-start p-3">
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Query failed</div>
              <div className="mt-1 break-words font-mono text-xs">{lastError}</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Table2 className="h-8 w-8 opacity-40" />
        <span>Run a query to see results</span>
      </div>
    );
  }

  const safeIndex = currentResultIndex < results.length ? currentResultIndex : 0;
  const current = results[safeIndex];
  const multi = results.length > 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {multi && (
        <div className="flex items-center justify-between border-b border-border px-2 py-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={safeIndex === 0}
            onClick={() => setCurrentResultIndex(safeIndex - 1)}
            title="Previous result"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Result {safeIndex + 1} of {results.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={safeIndex === results.length - 1}
            onClick={() => setCurrentResultIndex(safeIndex + 1)}
            title="Next result"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <motion.div
        key={safeIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="min-h-0 flex-1"
      >
        <ResultBody current={current} />
      </motion.div>
    </div>
  );
}