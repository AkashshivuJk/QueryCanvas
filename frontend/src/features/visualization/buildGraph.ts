import type { Edge } from "@xyflow/react";
import type { Metadata, TableInfo } from "@/types";
import type { TableNode, TableNodeData } from "./types";

/** Flatten all tables across schemas into a list. */
export function allTables(metadata: Metadata): TableInfo[] {
  return metadata.schemas.flatMap((s) => s.tables);
}

/** Map of table name -> TableInfo for quick lookup. */
export function tableMap(tables: TableInfo[]): Map<string, TableInfo> {
  const m = new Map<string, TableInfo>();
  for (const t of tables) m.set(t.name, t);
  return m;
}

/** Build table nodes from metadata. Preserves existing positions when provided. */
export function buildSchemaNodes(
  tables: TableInfo[],
  opts: {
    showColumns: boolean;
    highlight: string | null;
    existingPositions: Map<string, { x: number; y: number }>;
  },
): TableNode[] {
  return tables.map((table) => {
    const pos = opts.existingPositions.get(table.name);
    const data: TableNodeData = {
      table,
      highlight: opts.highlight === table.name,
      showColumns: opts.showColumns,
      compact: false,
      focused: false,
      emphasizeColumns: new Set<string>(),
    };
    return {
      id: table.name,
      type: "tableNode",
      position: pos ?? { x: 0, y: 0 },
      data,
      draggable: true,
    } satisfies TableNode;
  });
}

/** Build FK edges for the schema graph. */
export function buildSchemaEdges(
  tables: TableInfo[],
  opts: {
    highlight: string | null;
    connectorType: "default" | "straight" | "step";
    animationSpeed: "fast" | "normal" | "slow";
  },
): Edge[] {
  const dash =
    opts.animationSpeed === "slow" ? "12 8" : opts.animationSpeed === "fast" ? "2 4" : "6 6";
  const known = new Set(tables.map((t) => t.name));
  const edges: Edge[] = [];
  for (const table of tables) {
    for (const fk of table.foreign_keys) {
      if (!known.has(fk.to_table)) continue;
      const id = `${table.name}_${fk.from_column}__${fk.to_table}_${fk.to_column}`;
      const connected =
        opts.highlight !== null &&
        (table.name === opts.highlight || fk.to_table === opts.highlight);
      edges.push({
        id,
        source: table.name,
        target: fk.to_table,
        type: opts.connectorType,
        animated: true,
        style: {
          stroke: connected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          strokeWidth: connected ? 3 : 1.5,
          strokeDasharray: dash,
          opacity: opts.highlight !== null ? (connected ? 1 : 0.35) : 0.85,
        },
        data: { fromColumn: fk.from_column, toColumn: fk.to_column },
      });
    }
  }
  return edges;
}

/** Find tables that directly reference `tableName` (incoming FKs). */
export function incomingRefs(tables: TableInfo[], tableName: string): Array<{ from: string; fk: TableInfo["foreign_keys"][number] }> {
  const res: Array<{ from: string; fk: TableInfo["foreign_keys"][number] }> = [];
  for (const t of tables) {
    for (const fk of t.foreign_keys) {
      if (fk.to_table === tableName) {
        res.push({ from: t.name, fk });
      }
    }
  }
  return res;
}

/** Find tables referenced by `tableName` (outgoing FKs). */
export function outgoingRefs(table: TableInfo): Array<{ to: string; fk: TableInfo["foreign_keys"][number] }> {
  return table.foreign_keys.map((fk) => ({ to: fk.to_table, fk }));
}