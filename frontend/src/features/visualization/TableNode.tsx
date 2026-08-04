import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Key, Link } from "lucide-react";
import type { TableNode as TableNodeType } from "./types";
import { cn } from "@/lib/utils";

/**
 * Custom React Flow node rendering a database table as a dbdiagram.io-style card.
 * Header shows the table name + table/view badge; body lists columns with PK/FK
 * icons and datatypes. Handles on left (target) and right (source).
 */
function TableNodeBase({ data }: NodeProps<TableNodeType>) {
  const d = data;
  const { table, highlight, showColumns, compact, focused, emphasizeColumns } = d;

  const columnsToShow = compact
    ? table.columns.filter((c) => emphasizeColumns.has(c.name))
    : table.columns;

  return (
    <div
      className={cn(
        "w-[240px] rounded-md border bg-card text-card-foreground shadow-sm",
        "react-flow-table-node",
        highlight && "ring-2 ring-primary",
        focused && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div
        className={cn(
          "flex items-center justify-between rounded-t-md px-3 py-2 text-sm font-semibold",
          focused ? "bg-primary text-primary-foreground" : "bg-primary/15 text-foreground",
        )}
      >
        <span className="truncate">{table.name}</span>
        <span
          className={cn(
            "ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
            focused
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {table.type === "view" ? "view" : "table"}
        </span>
      </div>

      {!compact && !showColumns ? null : (
        <div className="divide-y divide-border/40">
          {columnsToShow.map((col) => (
            <div
              key={col.name}
              className="flex items-center gap-2 px-3 py-1 text-xs"
              title={col.is_pk ? "Primary key" : col.is_fk ? "Foreign key" : undefined}
            >
              {col.is_pk ? (
                <Key className="h-3 w-3 shrink-0 text-amber-500" aria-label="primary key" />
              ) : col.is_fk ? (
                <Link className="h-3 w-3 shrink-0 text-blue-500" aria-label="foreign key" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="flex-1 truncate font-medium">{col.name}</span>
              <span className="shrink-0 text-muted-foreground">{col.data_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeBase);