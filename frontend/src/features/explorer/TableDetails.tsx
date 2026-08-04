import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Database, Key, Link2, ShieldCheck, Zap, ArrowRight, Eye, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useUIStore } from "@/store/useUIStore";
import { TableDataViewer } from "@/features/data/TableDataViewer";
import type { TableInfo, Metadata, ForeignKey } from "@/types";

function findTable(metadata: Metadata | null, name: string): TableInfo | null {
  if (!metadata) return null;
  for (const schema of metadata.schemas) {
    const t = schema.tables.find((tb) => tb.name === name);
    if (t) return t;
  }
  return null;
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Database className="h-10 w-10 opacity-30" />
      <span>Select a table from the explorer to view its details.</span>
    </div>
  );
}

export function TableDetails() {
  const metadata = useDatabaseStore((s) => s.metadata);
  const selectedTableName = useUIStore((s) => s.selectedTableName);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);
  const [dataViewerOpen, setDataViewerOpen] = useState(false);

  const table = useMemo(() => findTable(metadata, selectedTableName ?? ""), [metadata, selectedTableName]);

  if (!selectedTableName || !table) {
    return <EmptyState />;
  }

  // Find tables that reference this table (incoming relationships).
  const incomingRefs: { fromTable: string; fk: ForeignKey }[] = [];
  if (metadata) {
    for (const schema of metadata.schemas) {
      for (const t of schema.tables) {
        for (const fk of t.foreign_keys) {
          if (fk.to_table === table.name) {
            incomingRefs.push({ fromTable: t.name, fk });
          }
        }
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex h-full min-h-0 flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {table.type === "view" ? (
              <Eye className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Database className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="truncate text-base font-semibold">{table.name}</h2>
            <Badge variant="secondary" className="text-[10px]">{table.type}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{table.row_count} rows</div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setSelectedTable(null)} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3 text-sm">
          {/* Columns */}
          <Section title="Columns" icon={<Key className="h-3.5 w-3.5" />}>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Name</th>
                    <th className="px-2 py-1.5 text-left font-medium">Type</th>
                    <th className="px-2 py-1.5 text-left font-medium">Nullable</th>
                    <th className="px-2 py-1.5 text-left font-medium">Default</th>
                    <th className="px-2 py-1.5 text-left font-medium">Keys</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((col) => (
                    <tr key={col.name} className="border-t border-border/60 hover:bg-accent/30">
                      <td className="px-2 py-1 font-mono">
                        <span className="flex items-center gap-1">
                          {col.is_pk && <Key className="h-3 w-3 text-amber-500" />}
                          {col.is_fk && <Link2 className="h-3 w-3 text-sky-500" />}
                          {col.name}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">{col.data_type}</td>
                      <td className="px-2 py-1">
                        {col.nullable ? (
                          <Badge variant="outline" className="text-[10px]">yes</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">no</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1 font-mono text-muted-foreground">{col.default ?? "—"}</td>
                      <td className="px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          {col.is_pk && <Badge variant="default" className="text-[10px]">PK</Badge>}
                          {col.is_fk && col.fk_references.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">FK → {col.fk_references[0].table}</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Indexes */}
          <Section title="Indexes" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            {table.indexes.length === 0 ? (
              <Empty>No indexes</Empty>
            ) : (
              <ul className="space-y-1">
                {table.indexes.map((idx) => (
                  <li key={idx.name} className="flex items-center gap-2 text-xs">
                    <span className="font-mono">{idx.name}</span>
                    <span className="text-muted-foreground">({idx.columns.join(", ")})</span>
                    {idx.unique && <Badge variant="default" className="text-[10px]">unique</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Constraints */}
          <Section title="Constraints" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            {table.constraints.length === 0 ? (
              <Empty>No constraints</Empty>
            ) : (
              <ul className="space-y-1">
                {table.constraints.map((c) => (
                  <li key={c.name} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{c.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.type}</Badge>
                      <span className="text-muted-foreground">({c.columns.join(", ")})</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{c.definition}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Foreign Keys */}
          <Section title="Foreign Keys" icon={<Link2 className="h-3.5 w-3.5" />}>
            {table.foreign_keys.length === 0 ? (
              <Empty>No foreign keys</Empty>
            ) : (
              <ul className="space-y-1">
                {table.foreign_keys.map((fk) => (
                  <li key={fk.name} className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono">{fk.from_column}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-sky-400">{fk.to_table}.{fk.to_column}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Triggers */}
          <Section title="Triggers" icon={<Zap className="h-3.5 w-3.5" />}>
            {table.triggers.length === 0 ? (
              <Empty>No triggers</Empty>
            ) : (
              <ul className="space-y-1">
                {table.triggers.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 text-xs">
                    <span className="font-mono">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{t.timing} {t.event}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Relationships */}
          <Section title="Relationships" icon={<Link2 className="h-3.5 w-3.5" />}>
            {table.foreign_keys.length === 0 && incomingRefs.length === 0 ? (
              <Empty>No relationships</Empty>
            ) : (
              <div className="space-y-2">
                {table.foreign_keys.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">This table references</div>
                    <ul className="space-y-1">
                      {table.foreign_keys.map((fk) => (
                        <li key={fk.name} className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono">{table.name}.{fk.from_column}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-sky-400">{fk.to_table}.{fk.to_column}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {incomingRefs.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Referenced by</div>
                    <ul className="space-y-1">
                      {incomingRefs.map((ref, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono text-sky-400">{ref.fromTable}.{ref.fk.from_column}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{table.name}.{ref.fk.to_column}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Data Viewer */}
          <Section title="Data" icon={<Eye className="h-3.5 w-3.5" />}>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1"
                onClick={() => setDataViewerOpen(true)}
              >
                <TableIcon className="h-3.5 w-3.5" /> Open Data Viewer
              </Button>
              <span className="text-[11px] text-muted-foreground">{table.row_count} rows</span>
            </div>
          </Section>
        </div>
      </ScrollArea>

      <Dialog open={dataViewerOpen} onOpenChange={setDataViewerOpen}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="flex-row items-center justify-between border-b border-border p-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <TableIcon className="h-4 w-4 text-muted-foreground" /> {table.name} — Data
            </DialogTitle>
            <DialogClose onClose={() => setDataViewerOpen(false)} />
          </DialogHeader>
          <div className="h-[70vh]">
            <TableDataViewer table={table} />
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic">{children}</div>;
}