import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Key, Link2, Database, Table2, Eye, Search, ChevronsDownUp, ChevronsUpDown, FunctionSquare, Zap, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useMetadata } from "@/hooks/useDatabase";
import { useUIStore } from "@/store/useUIStore";
import { useQueryStore } from "@/store/useQueryStore";
import { cn } from "@/lib/utils";
import type { Metadata, SchemaInfo, TableInfo } from "@/types";

interface NodeState {
  [key: string]: boolean;
}

export function ExplorerTree() {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const metadataQuery = useMetadata(activeDbPath);
  const metadata = metadataQuery.data;
  const selectedTableName = useUIStore((s) => s.selectedTableName);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<NodeState>({});

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function expandAll() {
    const next: NodeState = {};
    if (metadata) {
      for (const schema of metadata.schemas) {
        next[`schema:${schema.name}`] = true;
        next[`tables:${schema.name}`] = true;
        next[`views:${schema.name}`] = true;
        for (const t of schema.tables) {
          if (matchesSearch(t.name)) next[`table:${schema.name}:${t.name}`] = true;
        }
      }
    }
    setExpanded(next);
  }

  function collapseAll() {
    setExpanded({});
  }

  function matchesSearch(name: string): boolean {
    if (!search.trim()) return true;
    return name.toLowerCase().includes(search.toLowerCase());
  }

  const tree = useMemo(() => {
    if (!metadata) return null;
    // Build a filtered tree structure.
    return metadata;
  }, [metadata]);

  if (!activeDbPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Open or create a database to begin.
      </div>
    );
  }

  if (metadataQuery.isLoading) {
    return (
      <div className="flex h-full flex-col gap-1.5 p-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-5/6" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No metadata available.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={expandAll} title="Expand all">
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={collapseAll} title="Collapse all">
          <ChevronsDownUp className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1 text-sm">
          <div className="flex items-center gap-1 px-2 py-1 font-medium">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{metadata!.database}</span>
          </div>

          {/* If metadata has schemas, show schema grouping; otherwise show flat */}
          {metadata!.schemas.map((schema) => (
            <SchemaBranch
              key={schema.name}
              schema={schema}
              expanded={expanded}
              toggle={toggle}
              matchesSearch={matchesSearch}
              selectedTableName={selectedTableName}
              onSelectTable={setSelectedTable}
            />
          ))}

          {/* Flat top-level views/functions/triggers when present */}
          {(metadata!.views ?? []).length > 0 && (
            <FlatBranch label="Views" items={metadata!.views ?? []} icon={<Eye className="h-3.5 w-3.5" />} expanded={expanded} toggle={toggle} />
          )}
          {(metadata!.functions ?? []).length > 0 && (
            <FlatBranch label="Functions" items={metadata!.functions ?? []} icon={<FunctionSquare className="h-3.5 w-3.5" />} expanded={expanded} toggle={toggle} />
          )}
          {(metadata!.triggers ?? []).length > 0 && (
            <FlatBranch label="Triggers" items={metadata!.triggers ?? []} icon={<Zap className="h-3.5 w-3.5" />} expanded={expanded} toggle={toggle} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />;
}

function FlatBranch({
  label,
  items,
  icon,
  expanded,
  toggle,
}: {
  label: string;
  items: string[];
  icon: React.ReactNode;
  expanded: NodeState;
  toggle: (key: string) => void;
}) {
  const key = `flat:${label}`;
  const open = expanded[key];
  return (
    <div>
      <button
        className="flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-accent/40"
        onClick={() => toggle(key)}
      >
        <Chevron open={open} />
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
      </button>
      {open && (
        <div className="ml-4">
          {items.map((item) => (
            <div key={item} className="flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-accent/40">
              {icon}
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaBranch({
  schema,
  expanded,
  toggle,
  matchesSearch,
  selectedTableName,
  onSelectTable,
}: {
  schema: SchemaInfo;
  expanded: NodeState;
  toggle: (key: string) => void;
  matchesSearch: (name: string) => boolean;
  selectedTableName: string | null;
  onSelectTable: (name: string | null) => void;
}) {
  const schemaKey = `schema:${schema.name}`;
  const schemaOpen = expanded[schemaKey] ?? false;

  const tables = schema.tables.filter((t) => t.type === "table" && matchesSearch(t.name));
  const views = schema.tables.filter((t) => t.type === "view" && matchesSearch(t.name));

  const tablesKey = `tables:${schema.name}`;
  const viewsKey = `views:${schema.name}`;

  return (
    <div>
      <button
        className="flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-accent/40"
        onClick={() => toggle(schemaKey)}
      >
        <Chevron open={schemaOpen} />
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{schema.name}</span>
      </button>
      {schemaOpen && (
        <div className="ml-4">
          {tables.length > 0 && (
            <CategoryBranch
              label="Tables"
              icon={<Table2 className="h-3.5 w-3.5 text-muted-foreground" />}
              catKey={tablesKey}
              expanded={expanded}
              toggle={toggle}
              tables={tables}
              selectedTableName={selectedTableName}
              onSelectTable={onSelectTable}
            />
          )}
          {views.length > 0 && (
            <CategoryBranch
              label="Views"
              icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
              catKey={viewsKey}
              expanded={expanded}
              toggle={toggle}
              tables={views}
              selectedTableName={selectedTableName}
              onSelectTable={onSelectTable}
            />
          )}
          {tables.length === 0 && views.length === 0 && (
            <div className="px-2 py-0.5 text-[10px] text-muted-foreground">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBranch({
  label,
  icon,
  catKey,
  expanded,
  toggle,
  tables,
  selectedTableName,
  onSelectTable,
}: {
  label: string;
  icon: React.ReactNode;
  catKey: string;
  expanded: NodeState;
  toggle: (key: string) => void;
  tables: TableInfo[];
  selectedTableName: string | null;
  onSelectTable: (name: string | null) => void;
}) {
  const open = expanded[catKey] ?? false;
  return (
    <div>
      <button
        className="flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-accent/40"
        onClick={() => toggle(catKey)}
      >
        <Chevron open={open} />
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{tables.length}</span>
      </button>
      {open && (
        <div className="ml-4">
          {tables.map((table) => (
            <TableNode
              key={table.name}
              table={table}
              expanded={expanded}
              toggle={toggle}
              selected={selectedTableName === table.name}
              onSelect={onSelectTable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableNode({
  table,
  expanded,
  toggle,
  selected,
  onSelect,
}: {
  table: TableInfo;
  expanded: NodeState;
  toggle: (key: string) => void;
  selected: boolean;
  onSelect: (name: string | null) => void;
}) {
  const tableKey = `table::${table.name}`;
  const open = expanded[tableKey] ?? false;
  const setCurrentSql = useQueryStore((s) => s.setCurrentSql);

  const subCategories = [
    { label: "Indexes", key: `idx:${table.name}`, items: table.indexes },
    { label: "Constraints", key: `con:${table.name}`, items: table.constraints },
    { label: "Triggers", key: `trg:${table.name}`, items: table.triggers },
    { label: "Foreign Keys", key: `fk:${table.name}`, items: table.foreign_keys },
  ].filter((c) => c.items.length > 0);

  function handleSelect() {
    onSelect(table.name);
  }

  function generateDrop() {
    const drop = table.type === "view" ? `DROP VIEW IF EXISTS ${table.name};` : `DROP TABLE IF EXISTS ${table.name};`;
    setCurrentSql(drop);
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="select-none">
          <div
            className={cn(
              "group flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent/40",
              selected && "bg-primary/15 text-primary-foreground/90",
            )}
          >
            <button onClick={() => toggle(tableKey)} className="shrink-0">
              <Chevron open={open} />
            </button>
            {table.type === "view" ? (
              <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <button className="min-w-0 flex-1 truncate text-left" onClick={handleSelect}>
              {table.name}
            </button>
            <span className="shrink-0 text-[10px] text-muted-foreground">{table.row_count}</span>
          </div>
          {open && (
            <div className="ml-4">
              {/* Columns */}
              <div className="px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Columns</div>
              {table.columns.map((col) => (
                <div key={col.name} className="flex items-center gap-1 px-3 py-0.5 text-xs hover:bg-accent/40">
                  {col.is_pk ? (
                    <Key className="h-3 w-3 shrink-0 text-amber-500" />
                  ) : col.is_fk ? (
                    <Link2 className="h-3 w-3 shrink-0 text-sky-500" />
                  ) : (
                    <span className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{col.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{col.data_type}</span>
                </div>
              ))}
              {subCategories.map((cat) => (
                <SubCategory key={cat.key} label={cat.label} catKey={cat.key} expanded={expanded} toggle={toggle} />
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleSelect}>View Details</ContextMenuItem>
        <ContextMenuItem onClick={() => setCurrentSql(`SELECT * FROM ${table.name} LIMIT 100;`)}>View Data</ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard?.writeText(table.name).catch(() => {})}>
          Copy Name
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={generateDrop}>
          Drop Table (generate SQL)
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SubCategory({
  label,
  catKey,
  expanded,
  toggle,
}: {
  label: string;
  catKey: string;
  expanded: NodeState;
  toggle: (key: string) => void;
}) {
  const open = expanded[catKey] ?? false;
  const icon =
    label === "Indexes" ? <ShieldCheck className="h-3 w-3" /> :
    label === "Triggers" ? <Zap className="h-3 w-3" /> :
    <ChevronDown className="h-3 w-3" />;
  return (
    <div>
      <button
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-accent/40"
        onClick={() => toggle(catKey)}
      >
        <Chevron open={open} />
        {icon}
        <span>{label}</span>
      </button>
      {/* sub-items handled in detail view; tree shows label only for brevity */}
      {open && (
        <div className="px-4 py-0.5 text-[10px] text-muted-foreground">
          See table details for {label.toLowerCase()}.
        </div>
      )}
    </div>
  );
}

// Suppress unused import warning for Metadata type (kept for clarity / future use).
export type { Metadata };