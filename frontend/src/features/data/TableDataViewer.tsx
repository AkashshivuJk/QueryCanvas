import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileJson, Loader2, Search, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useEditCell, useRows } from "@/hooks/useDatabase";
import type { ColumnInfo, JsonValue, TableInfo } from "@/types";
import { downloadCsv } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [25, 50, 100];

interface TableDataViewerProps {
  table: TableInfo;
  onClose?: () => void;
}

/**
 * Spreadsheet-like grid for browsing and inline-editing a table's rows.
 * Pagination, sorting, search, inline edit, and CSV/JSON export.
 *
 * Editing note: the backend `rows` endpoint does not return the implicit
 * SQLite `rowid` column, and `update_cell` updates `WHERE rowid = ?`. For
 * tables whose integer primary key aliases the rowid, that PK value equals
 * the rowid, so we use the integer PK column value as the rowid. Tables
 * without an integer PK are rendered read-only.
 */
export function TableDataViewer({ table }: TableDataViewerProps) {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editCell, setEditCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const offset = (page - 1) * pageSize;

  const rowsQuery = useRows(activeDbPath, table.name, {
    limit: pageSize,
    offset,
    sort,
    dir,
    search: debouncedSearch || undefined,
  });

  const editMut = useEditCell();

  // Determine the integer primary key column (alias of rowid in SQLite).
  const rowidColumn = useMemo(() => {
    const intPk = table.columns.find(
      (c) => c.is_pk && /^int/i.test(c.data_type),
    );
    return intPk?.name ?? null;
  }, [table.columns]);

  const columnByName = useMemo(() => {
    const m = new Map<string, ColumnInfo>();
    for (const c of table.columns) m.set(c.name, c);
    return m;
  }, [table.columns]);

  const total = rowsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columns = rowsQuery.data?.columns ?? [];
  const rows = rowsQuery.data?.rows ?? [];

  function handleSort(col: string) {
    if (sort === col) {
      if (dir === "asc") {
        setDir("desc");
      } else {
        // third click clears sort
        setSort(undefined);
        setDir("asc");
      }
    } else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  }

  function startEdit(rowIdx: number, colIdx: number) {
    // Editing requires the rowid column to be present.
    if (!rowidColumn) {
      toast.error("This table has no editable rowid (integer primary key required)");
      return;
    }
    const colName = columns[colIdx];
    if (!colName) return;
    const colInfo = columnByName.get(colName);
    if (!colInfo) return;
    setEditCell({ rowIdx, colIdx });
    const val = rows[rowIdx]?.[colIdx];
    setEditValue(val === null ? "" : String(val));
  }

  function commitEdit() {
    if (!editCell || !activeDbPath || !rowidColumn) {
      setEditCell(null);
      return;
    }
    const { rowIdx, colIdx } = editCell;
    const colName = columns[colIdx];
    const rowidIdx = columns.indexOf(rowidColumn);
    const rawRowid = rowidIdx >= 0 ? rows[rowIdx]?.[rowidIdx] : undefined;
    if (rawRowid === undefined || rawRowid === null) {
      toast.error("Cannot resolve rowid for this row");
      setEditCell(null);
      return;
    }
    const rowid = Number(rawRowid);
    if (!Number.isFinite(rowid)) {
      toast.error("Rowid is not a number; cannot edit");
      setEditCell(null);
      return;
    }

    const colInfo = columnByName.get(colName);
    let value: JsonValue;
    if (editValue === "") {
      value = colInfo?.nullable ? null : "";
    } else if (colInfo && /^int/i.test(colInfo.data_type)) {
      const n = Number(editValue);
      value = Number.isFinite(n) ? Math.trunc(n) : null;
    } else if (colInfo && /real|float|double|numeric/i.test(colInfo.data_type)) {
      const n = Number(editValue);
      value = Number.isFinite(n) ? n : null;
    } else {
      value = editValue;
    }

    const prevValue = rows[rowIdx]?.[colIdx];
    setEditCell(null);
    if (String(prevValue ?? "") === String(value ?? "")) return;

    editMut.mutate(
      { path: activeDbPath, table: table.name, rowid, column: colName, value },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : "Edit failed"),
      },
    );
  }

  function handleEditKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditCell(null);
    }
  }

  function exportCsv() {
    if (!rowsQuery.data) return;
    downloadCsv(`${table.name}.csv`, columns, rows as (string | number | boolean | null)[][]);
    toast.success("CSV exported");
  }

  function exportJson() {
    if (!rowsQuery.data) return;
    const objs = rows.map((r) => {
      const o: Record<string, JsonValue> = {};
      columns.forEach((c, i) => {
        o[c] = r[i] ?? null;
      });
      return o;
    });
    const blob = new Blob([JSON.stringify(objs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("JSON exported");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={exportJson} disabled={rows.length === 0}>
          <FileJson className="h-3.5 w-3.5" /> JSON
        </Button>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        {rowsQuery.isLoading ? (
          <div className="space-y-1.5 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : rowsQuery.isError ? (
          <div className="p-4 text-xs text-destructive">
            Failed to load rows: {rowsQuery.error instanceof Error ? rowsQuery.error.message : "unknown error"}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <TableIcon className="h-8 w-8 opacity-30" />
            <span>No rows in this table.</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                {columns.map((c, i) => {
                  const active = sort === c;
                  return (
                    <th
                      key={c}
                      onClick={() => handleSort(c)}
                      className={cn(
                        "cursor-pointer select-none border-b border-border px-2 py-1.5 text-left font-medium whitespace-nowrap hover:bg-accent/50",
                        active && "text-primary",
                      )}
                      title={`Sort by ${c}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c}
                        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
                        {i === 0 && rowidColumn === c && (
                          <span className="rounded bg-primary/15 px-1 text-[9px] text-primary">rowid</span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50 hover:bg-accent/20">
                  {row.map((cell, ci) => {
                    const isEditing = editCell?.rowIdx === ri && editCell?.colIdx === ci;
                    const colName = columns[ci];
                    const colInfo = colName ? columnByName.get(colName) : undefined;
                    const editable = !!rowidColumn && !!colInfo;
                    if (isEditing) {
                      return (
                        <td key={ci} className="border-b border-border/50 px-0 py-0">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKey}
                            className="h-7 w-full bg-background px-2 font-mono text-xs outline-none ring-1 ring-primary"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={ci}
                        onDoubleClick={() => editable && startEdit(ri, ci)}
                        className={cn(
                          "border-b border-border/50 px-2 py-1 font-mono whitespace-nowrap",
                          editable && "cursor-text",
                        )}
                        title={editable ? "Double-click to edit" : undefined}
                      >
                        {cell === null ? (
                          <span className="italic text-muted-foreground">NULL</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 border-t border-border p-2 text-xs text-muted-foreground">
        <span>Page</span>
        <span className="font-medium text-foreground">{page}</span>
        <span>of</span>
        <span className="font-medium text-foreground">{totalPages}</span>
        <span className="mx-1">·</span>
        <span>{total} rows</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-7 w-[70px] text-xs"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={String(s)}>{s} / page</option>
            ))}
          </Select>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {editMut.isPending && (
          <span className="flex items-center gap-1 text-[10px]"><Loader2 className="h-3 w-3 animate-spin" /> saving…</span>
        )}
      </div>
    </div>
  );
}