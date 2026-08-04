import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Database, Key, Link2, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useUIStore } from "@/store/useUIStore";
import type { ColumnInfo } from "@/types";

type ResultKind = "table" | "column" | "index" | "constraint";

interface SearchResult {
  kind: ResultKind;
  key: string;
  label: string;
  sublabel?: string;
  tableName: string;
  column?: ColumnInfo;
  icon: React.ReactNode;
}

export function GlobalSearch() {
  const open = useUIStore((s) => s.globalSearchOpen);
  const setOpen = useUIStore((s) => s.setGlobalSearchOpen);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);
  const metadata = useDatabaseStore((s) => s.metadata);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Build flat searchable index from metadata.
  const index = useMemo(() => {
    const results: SearchResult[] = [];
    if (!metadata) return results;
    for (const schema of metadata.schemas) {
      for (const t of schema.tables) {
        results.push({
          kind: "table",
          key: `table:${t.name}`,
          label: `Table: ${t.name}`,
          sublabel: `${t.row_count} rows`,
          tableName: t.name,
          icon: <Database className="h-4 w-4 text-sky-400" />,
        });
        for (const col of t.columns) {
          results.push({
            kind: "column",
            key: `column:${t.name}.${col.name}`,
            label: `Column: ${t.name}.${col.name}`,
            sublabel: col.data_type,
            tableName: t.name,
            column: col,
            icon: <Key className="h-4 w-4 text-amber-400" />,
          });
        }
        for (const idx of t.indexes) {
          results.push({
            kind: "index",
            key: `index:${t.name}.${idx.name}`,
            label: `Index: ${idx.name}`,
            sublabel: `on ${t.name} (${idx.columns.join(", ")})`,
            tableName: t.name,
            icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
          });
        }
        for (const c of t.constraints) {
          results.push({
            kind: "constraint",
            key: `constraint:${t.name}.${c.name}`,
            label: `Constraint: ${c.name}`,
            sublabel: `${c.type} on ${t.name} (${c.columns.join(", ")})`,
            tableName: t.name,
            icon: <Link2 className="h-4 w-4 text-purple-400" />,
          });
        }
      }
    }
    return results;
  }, [metadata]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((r) => r.label.toLowerCase().includes(q) || (r.sublabel ?? "").toLowerCase().includes(q));
  }, [index, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function selectResult(r: SearchResult) {
    setSelectedTable(r.tableName);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = filtered[activeIndex] ?? filtered[0];
      if (r) selectResult(r);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Group filtered results by kind for display.
  const grouped = useMemo(() => {
    const order: ResultKind[] = ["table", "column", "index", "constraint"];
    const labels: Record<ResultKind, string> = {
      table: "Tables",
      column: "Columns",
      index: "Indexes",
      constraint: "Constraints",
    };
    const map = new Map<ResultKind, SearchResult[]>();
    for (const k of order) map.set(k, []);
    let flatIdx = 0;
    const idxLookup: Record<number, { kind: ResultKind; local: number }> = {};
    for (const r of filtered) {
      const list = map.get(r.kind);
      if (list) {
        idxLookup[flatIdx] = { kind: r.kind, local: list.length };
        list.push(r);
        flatIdx++;
      }
    }
    return { order, labels, map, idxLookup };
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.12 }}
            className="relative z-10 w-full max-w-xl"
          >
            <div className="rounded-lg border border-border bg-card p-4 shadow-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search tables, columns, indexes, constraints…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="pl-9"
                />
              </div>

              <div className="mt-3 max-h-[50vh] overflow-auto">
                {query.trim() === "" ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Start typing to search…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No matches</div>
                ) : (
                  <div className="space-y-3">
                    {grouped.order.map((kind) => {
                      const items = grouped.map.get(kind) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <div key={kind}>
                          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {grouped.labels[kind]}
                          </div>
                          <div className="space-y-0.5">
                            {items.map((r) => {
                              const globalIdx = filtered.indexOf(r);
                              const isActive = globalIdx === activeIndex;
                              return (
                                <button
                                  key={r.key}
                                  onMouseEnter={() => setActiveIndex(globalIdx)}
                                  onClick={() => selectResult(r)}
                                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                    isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                  }`}
                                >
                                  {r.icon}
                                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                                  {r.sublabel && (
                                    <span className="shrink-0 text-xs text-muted-foreground">{r.sublabel}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
                <span>↑↓ to navigate · Enter to select · Esc to close</span>
                <span>{filtered.length} results</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}